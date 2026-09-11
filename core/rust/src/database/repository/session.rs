//! Repositorio de sesiones LIVE (tabla `live_sessions`, Sección 22).
//! Conecta `LiveSessionState` (Etapa 5) con SQLite.

use crate::contracts::SessionStatus;
use crate::database::Database;
use crate::error::CoreResult;
use crate::session::LiveSessionState;

pub struct LiveSessionRepository<'a> {
    db: &'a Database,
}

impl<'a> LiveSessionRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Guarda o actualiza (upsert por `id`) la sesión completa, incluido
    /// Best Gift si existe.
    pub fn save(&self, session: &LiveSessionState) -> CoreResult<()> {
        let status_str = match session.status {
            SessionStatus::NoSession => "NO_SESSION",
            SessionStatus::Active => "ACTIVE",
            SessionStatus::Ending => "ENDING",
            SessionStatus::Completed => "COMPLETED",
        };

        let (best_gift_id, best_gift_coins, best_gift_sender_id, best_gift_sender_name) =
            match &session.best_gift {
                Some(bg) => (
                    Some(bg.gift.id.clone()),
                    Some(bg.coins as i64),
                    Some(bg.sender.id.clone()),
                    Some(bg.sender.display_name.clone()),
                ),
                None => (None, None, None, None),
            };

        self.db.with_connection(|conn| {
            conn.execute(
                "INSERT INTO live_sessions (
                    id, tiktok_user_id, tiktok_username, started_at, ended_at,
                    duration_seconds, status, total_likes, total_coins, total_gifts,
                    total_follows, total_shares, total_comments, max_viewers,
                    best_gift_id, best_gift_coins, best_gift_sender_id, best_gift_sender_name
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
                 ON CONFLICT(id) DO UPDATE SET
                    ended_at = excluded.ended_at,
                    duration_seconds = excluded.duration_seconds,
                    status = excluded.status,
                    total_likes = excluded.total_likes,
                    total_coins = excluded.total_coins,
                    total_gifts = excluded.total_gifts,
                    total_follows = excluded.total_follows,
                    total_shares = excluded.total_shares,
                    total_comments = excluded.total_comments,
                    max_viewers = excluded.max_viewers,
                    best_gift_id = excluded.best_gift_id,
                    best_gift_coins = excluded.best_gift_coins,
                    best_gift_sender_id = excluded.best_gift_sender_id,
                    best_gift_sender_name = excluded.best_gift_sender_name",
                rusqlite::params![
                    session.id,
                    session.tiktok_user_id,
                    session.tiktok_username,
                    session.started_at as i64,
                    session.ended_at.map(|v| v as i64),
                    session.duration_seconds() as i64,
                    status_str,
                    session.counters.total_likes as i64,
                    session.counters.total_coins as i64,
                    session.counters.total_gifts as i64,
                    session.counters.total_follows as i64,
                    session.counters.total_shares as i64,
                    session.counters.total_comments as i64,
                    session.counters.max_viewers as i64,
                    best_gift_id,
                    best_gift_coins,
                    best_gift_sender_id,
                    best_gift_sender_name,
                ],
            )?;
            Ok(())
        })
    }

    /// Lee de vuelta los campos clave de una sesión guardada (para tests e
    /// inspección; el Dashboard/History UI de etapas posteriores hará
    /// consultas más ricas cuando exista).
    pub fn find_status(&self, session_id: &str) -> CoreResult<Option<String>> {
        self.db.with_connection(|conn| {
            conn.query_row(
                "SELECT status FROM live_sessions WHERE id = ?1",
                rusqlite::params![session_id],
                |row| row.get::<_, String>(0),
            )
            .map(Some)
            .or_else(|e| {
                if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
                    Ok(None)
                } else {
                    Err(e)
                }
            })
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::clock::SimulationClock;
    use crate::session::SessionManager;

    #[test]
    fn guarda_y_recupera_una_sesion_completa_con_best_gift() {
        let db = Database::open_in_memory().unwrap();
        let manager = SessionManager::new();
        let clock = SimulationClock::new(0);

        manager.start_session(&clock, "live_test", "uid_1", "carlos");
        manager.process_event(&crate::contracts::AppEvent::Gift(crate::contracts::GiftEvent {
            id: "evt_1".to_string(),
            timestamp: 0,
            session_id: "live_test".to_string(),
            source: crate::contracts::EventSource::Simulation,
            user: crate::contracts::User {
                id: "sender_1".to_string(),
                username: "sender_1".to_string(),
                display_name: "Sender".to_string(),
                avatar_url: None,
            },
            metadata: None,
            gift: crate::contracts::Gift {
                id: "5655".to_string(),
                name: "Rose".to_string(),
                coins: 1,
                image_url: None,
                region: "CO".to_string(),
            },
            quantity: 10,
            total_coins: 10,
            repeat_end: true,
        }));

        clock.advance_ms(3_000);
        let ended = manager.end_session(&clock).unwrap();

        let repo = LiveSessionRepository::new(&db);
        repo.save(&ended).unwrap();

        assert_eq!(repo.find_status("live_test").unwrap(), Some("COMPLETED".to_string()));

        // Verificación directa de columnas clave, incluida Best Gift.
        let (total_coins, best_gift_id): (i64, Option<String>) = db
            .with_connection(|conn| {
                conn.query_row(
                    "SELECT total_coins, best_gift_id FROM live_sessions WHERE id = 'live_test'",
                    [],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
            })
            .unwrap();
        assert_eq!(total_coins, 10);
        assert_eq!(best_gift_id, Some("5655".to_string()));
    }

    #[test]
    fn find_status_devuelve_none_si_no_existe() {
        let db = Database::open_in_memory().unwrap();
        let repo = LiveSessionRepository::new(&db);
        assert_eq!(repo.find_status("no_existe").unwrap(), None);
    }
}

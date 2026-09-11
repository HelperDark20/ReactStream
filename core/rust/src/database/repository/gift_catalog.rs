//! Repositorio del Gift Catalog (tabla `gift_catalog`, Sección 22).
//! Regla #73: el catálogo se mantiene estable durante LIVE.
//! Regla #74: no depende de un sitio externo en runtime.
//! Regla #57: un regalo desconocido no bloquea el evento — genera WARN
//! y devuelve un fallback que conserva el id/coins que llegaron del Bridge.

use crate::contracts::Gift;
use crate::database::Database;
use crate::error::CoreResult;
use crate::logging::{LogEntry, LogLevel, Logger};
use crate::clock::ProductionClock;

pub struct GiftCatalogRepository<'a> {
    db: &'a Database,
}

impl<'a> GiftCatalogRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Busca un regalo exacto por (id, region). Devuelve `None` si no existe.
    pub fn find(&self, id: &str, region: &str) -> CoreResult<Option<Gift>> {
        self.db.with_connection(|conn| {
            conn.query_row(
                "SELECT id, name, coins, image_url, region FROM gift_catalog
                 WHERE id = ?1 AND region = ?2 AND active = 1",
                rusqlite::params![id, region],
                |row| {
                    Ok(Gift {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        coins: row.get::<_, i64>(2)? as u64,
                        image_url: row.get(3)?,
                        region: row.get(4)?,
                    })
                },
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

    /// Busca por id en cualquier región (útil cuando el Bridge no especifica
    /// región, caso poco común pero posible).
    pub fn find_any_region(&self, id: &str) -> CoreResult<Option<Gift>> {
        self.db.with_connection(|conn| {
            conn.query_row(
                "SELECT id, name, coins, image_url, region FROM gift_catalog
                 WHERE id = ?1 AND active = 1 LIMIT 1",
                rusqlite::params![id],
                |row| {
                    Ok(Gift {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        coins: row.get::<_, i64>(2)? as u64,
                        image_url: row.get(3)?,
                        region: row.get(4)?,
                    })
                },
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

    /// Lista todos los regalos activos de una región, ordenados por coins.
    pub fn list_by_region(&self, region: &str) -> CoreResult<Vec<Gift>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, coins, image_url, region FROM gift_catalog
                 WHERE region = ?1 AND active = 1
                 ORDER BY coins ASC",
            )?;
            let rows = stmt.query_map(rusqlite::params![region], |row| {
                Ok(Gift {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    coins: row.get::<_, i64>(2)? as u64,
                    image_url: row.get(3)?,
                    region: row.get(4)?,
                })
            })?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
        })
    }

    /// Búsqueda por nombre parcial (para el editor de automatizaciones).
    pub fn search(&self, query: &str, region: &str) -> CoreResult<Vec<Gift>> {
        let pattern = format!("%{}%", query.to_lowercase());
        self.db.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, coins, image_url, region FROM gift_catalog
                 WHERE region = ?1 AND active = 1
                 AND LOWER(name) LIKE ?2
                 ORDER BY coins ASC
                 LIMIT 20",
            )?;
            let rows = stmt.query_map(rusqlite::params![region, pattern], |row| {
                Ok(Gift {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    coins: row.get::<_, i64>(2)? as u64,
                    image_url: row.get(3)?,
                    region: row.get(4)?,
                })
            })?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
        })
    }

    /// Resuelve un regalo enriqueciendo los datos que llegaron del Bridge
    /// con la info del catálogo local. Regla #57: si el regalo no está en
    /// el catálogo, NO bloquea el evento — devuelve el `raw` con un WARN
    /// para que el flujo continúe.
    pub fn resolve_or_fallback(
        &self,
        raw: Gift,
        logger: &dyn Logger,
    ) -> Gift {
        match self.find(&raw.id, &raw.region) {
            Ok(Some(catalogued)) => catalogued,
            Ok(None) => {
                logger.log(
                    LogEntry::new(
                        &ProductionClock,
                        LogLevel::Warn,
                        "gift_catalog",
                        format!(
                            "regalo desconocido id={} region={}: usando datos del Bridge como fallback (Regla #57)",
                            raw.id, raw.region
                        ),
                    ),
                );
                raw
            }
            Err(e) => {
                logger.log(
                    LogEntry::new(
                        &ProductionClock,
                        LogLevel::Error,
                        "gift_catalog",
                        format!("error al buscar regalo id={}: {e}", raw.id),
                    ),
                );
                raw
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::{seeds, Database};
    use crate::logging::InMemoryLogger;

    fn setup() -> Database {
        let db = Database::open_in_memory().unwrap();
        seeds::run_seeds(&db, 0).unwrap();
        db
    }

    #[test]
    fn seed_co_inserta_regalos() {
        let db = setup();
        let repo = GiftCatalogRepository::new(&db);
        let gifts = repo.list_by_region("CO").unwrap();
        assert!(gifts.len() >= 40);
    }

    #[test]
    fn seed_co_es_idempotente() {
        let db = setup();
        seeds::run_seeds(&db, 1_000).unwrap();
        let repo = GiftCatalogRepository::new(&db);
        let count = repo.list_by_region("CO").unwrap().len();
        seeds::run_seeds(&db, 2_000).unwrap();
        assert_eq!(repo.list_by_region("CO").unwrap().len(), count);
    }

    #[test]
    fn find_devuelve_rosa_de_colombia() {
        let db = setup();
        let repo = GiftCatalogRepository::new(&db);
        let gift = repo.find("5655", "CO").unwrap().expect("Rosa debe existir");
        assert_eq!(gift.coins, 1);
        assert_eq!(gift.region, "CO");
    }

    #[test]
    fn find_devuelve_none_para_id_inexistente() {
        let db = setup();
        let repo = GiftCatalogRepository::new(&db);
        assert!(repo.find("id_inexistente", "CO").unwrap().is_none());
    }

    #[test]
    fn search_encuentra_por_nombre_parcial_case_insensitive() {
        let db = setup();
        let repo = GiftCatalogRepository::new(&db);
        let results = repo.search("rosa", "CO").unwrap();
        assert!(!results.is_empty());
        assert!(results[0].name.to_lowercase().contains("rosa"));
    }

    #[test]
    fn list_by_region_ordena_por_coins_ascendente() {
        let db = setup();
        let repo = GiftCatalogRepository::new(&db);
        let gifts = repo.list_by_region("CO").unwrap();
        for w in gifts.windows(2) {
            assert!(w[0].coins <= w[1].coins);
        }
    }

    #[test]
    fn resolve_or_fallback_enriquece_desde_catalogo() {
        let db = setup();
        let repo = GiftCatalogRepository::new(&db);
        let logger = InMemoryLogger::new();
        let raw = Gift {
            id: "5655".to_string(),
            name: "nombre_incorrecto_del_bridge".to_string(),
            coins: 99,
            image_url: None,
            region: "CO".to_string(),
        };
        let resolved = repo.resolve_or_fallback(raw, &logger);
        // Debe usar el nombre del catálogo, no el del Bridge
        assert_eq!(resolved.name, "Rosa");
        assert_eq!(resolved.coins, 1);
        assert!(logger.entries().is_empty()); // sin warnings
    }

    #[test]
    fn resolve_or_fallback_usa_raw_si_regalo_desconocido_y_genera_warn() {
        let db = setup();
        let repo = GiftCatalogRepository::new(&db);
        let logger = InMemoryLogger::new();
        let raw = Gift {
            id: "regalo_nuevo_de_tiktok".to_string(),
            name: "Regalo Nuevo".to_string(),
            coins: 500,
            image_url: None,
            region: "CO".to_string(),
        };
        let resolved = repo.resolve_or_fallback(raw, &logger);
        assert_eq!(resolved.id, "regalo_nuevo_de_tiktok");
        assert_eq!(resolved.coins, 500);
        // Debe haber generado exactamente un WARN
        let entries = logger.entries();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].level, crate::logging::LogLevel::Warn);
    }
}

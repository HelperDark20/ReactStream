// src/database/repository/gift_catalog_sync.rs
// Sincronización del catálogo de regalos recibido del Bridge al conectarse.
// Regla #73: el catálogo se mantiene estable durante LIVE.
// Regla #74: no depende de un sitio externo en runtime — se cachea en SQLite.

use crate::database::Database;
use crate::error::CoreResult;

pub struct GiftCatalogSyncEntry {
    pub id: String,
    pub name: String,
    pub coins: u64,
    pub image_url: Option<String>,
    pub region: String,
}

pub struct GiftCatalogSyncRepository<'a> {
    db: &'a Database,
}

impl<'a> GiftCatalogSyncRepository<'a> {
    pub fn new(db: &'a Database) -> Self {
        Self { db }
    }

    /// Inserta o actualiza (upsert) todos los regalos recibidos del Bridge.
    /// Idempotente: correrlo dos veces no duplica ni pisa datos del usuario.
    pub fn sync(&self, gifts: &[GiftCatalogSyncEntry], now_ms: u64) -> CoreResult<usize> {
        let mut updated = 0usize;
        self.db.with_connection(|conn| {
            for gift in gifts {
                let rows = conn.execute(
                    "INSERT INTO gift_catalog (id, name, coins, image_url, region, active, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)
                     ON CONFLICT(id, region) DO UPDATE SET
                       name       = excluded.name,
                       coins      = excluded.coins,
                       image_url  = excluded.image_url,
                       active     = 1,
                       updated_at = excluded.updated_at",
                    rusqlite::params![
                        gift.id,
                        gift.name,
                        gift.coins as i64,
                        gift.image_url,
                        gift.region,
                        now_ms as i64,
                    ],
                )?;
                updated += rows;
            }
            Ok(())
        })?;
        Ok(updated)
    }

    /// Devuelve todos los regalos activos del catálogo ordenados por coins.
    pub fn list_all(&self) -> CoreResult<Vec<(String, String, i64, Option<String>)>> {
        self.db.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, coins, image_url FROM gift_catalog
                 WHERE active = 1 ORDER BY coins ASC"
            )?;
            let rows = stmt.query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            })?;
            rows.collect::<rusqlite::Result<Vec<_>>>()
        })
    }
}

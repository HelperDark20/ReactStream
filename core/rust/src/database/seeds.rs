//! Seeds (Regla #75: separados formalmente de las migraciones). Idempotentes:
//! correr dos veces no duplica ni pisa cambios del usuario.
//! Regla #74: el catálogo local no depende de un sitio externo en runtime.

use super::repository::settings::SettingsRepository;
use super::Database;
use crate::error::CoreResult;
use crate::state::settings::AppSettings;

pub fn run_seeds(db: &Database, now_ms: u64) -> CoreResult<()> {
    seed_app_settings(db, now_ms)?;
    seed_gift_catalog_co(db, now_ms)?;
    Ok(())
}

fn seed_app_settings(db: &Database, now_ms: u64) -> CoreResult<()> {
    let repo = SettingsRepository::new(db);
    let count: i64 = db.with_connection(|conn| {
        conn.query_row("SELECT COUNT(*) FROM app_settings", [], |r| r.get(0))
    })?;
    if count == 0 {
        repo.save(&AppSettings::default(), now_ms)?;
    }
    Ok(())
}

fn seed_gift_catalog_co(db: &Database, now_ms: u64) -> CoreResult<()> {
    let count: i64 = db.with_connection(|conn| {
        conn.query_row(
            "SELECT COUNT(*) FROM gift_catalog WHERE region = 'CO'",
            [],
            |r| r.get(0),
        )
    })?;
    if count > 0 {
        return Ok(());
    }

    let gifts: &[(&str, &str, i64, Option<&str>)] = &[
        ("5655", "Rosa", 1, None),
        ("6480", "Dedo pulgar", 1, None),
        ("5657", "TikTok", 1, None),
        ("6136", "Corazon me encanta", 1, None),
        ("7022", "Osito abrazable", 1, None),
        ("5904", "Perfume", 20, None),
        ("6139", "Microfono", 25, None),
        ("7191", "Cohete espacial", 20, None),
        ("7004", "Casco de futbol", 25, None),
        ("6748", "Coche deportivo", 50, None),
        ("6407", "Trofeo", 50, None),
        ("7399", "Bombas de confeti", 100, None),
        ("7445", "Taza de cafe", 1, None),
        ("6861", "Helado", 1, None),
        ("6268", "Palomitas", 1, None),
        ("6140", "Corazones rosas", 5, None),
        ("6741", "Telefono inteligente", 5, None),
        ("7221", "Casco americano", 68, None),
        ("6738", "Microfono de rap", 88, None),
        ("7131", "Diadema gamer", 155, None),
        ("6837", "Patineta", 155, None),
        ("5662", "Palmas", 99, None),
        ("7219", "Pesas", 198, None),
        ("7300", "Planeta", 299, None),
        ("7406", "Bomba de fuego", 299, None),
        ("5888", "Manos de amor", 5, None),
        ("6488", "Globos de corazon", 10, None),
        ("7333", "Chispa magica", 10, None),
        ("6209", "Microfono dorado", 500, None),
        ("7128", "Corona de rey", 500, None),
        ("7401", "Dragon volador", 500, None),
        ("6383", "Barco pirata", 1000, None),
        ("7411", "Universo", 1000, None),
        ("6216", "Leon", 29999, None),
        ("7389", "Leon dorado", 29999, None),
        ("7382", "Cohete interestelar", 9999, None),
        ("7416", "Galaxia explosiva", 9999, None),
        ("7130", "Avion privado", 9999, None),
        ("7025", "Montana rusa", 3000, None),
        ("7319", "Tormenta de nieve", 1999, None),
        ("6492", "Fuegos artificiales", 1999, None),
        ("7296", "Ola del oceano", 3000, None),
        ("7103", "Ciudad nocturna", 5000, None),
        ("6990", "Fenix", 5000, None),
        ("7417", "Palacio dorado", 9999, None),
    ];

    db.with_connection(|conn| {
        let mut stmt = conn.prepare(
            "INSERT OR IGNORE INTO gift_catalog
             (id, name, coins, image_url, region, active, updated_at)
             VALUES (?1, ?2, ?3, ?4, 'CO', 1, ?5)",
        )?;
        for (id, name, coins, image_url) in gifts {
            stmt.execute(rusqlite::params![id, name, coins, image_url, now_ms as i64])?;
        }
        Ok(())
    })
}
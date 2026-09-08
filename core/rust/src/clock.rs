//! Clock (Sección 14): abstrae el tiempo para que el Timer Engine y otros
//! módulos usen timestamps reales en producción y tiempo controlado en
//! Simulation. Regla #27: Timer usa timestamps/Clock, NUNCA acumulación
//! ingenua de ticks. Regla #67: Simulation usa exactamente el mismo pipeline
//! — por eso comparte el mismo trait `Clock`, solo cambia la implementación.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

pub trait Clock: Send + Sync {
    fn now_ms(&self) -> u64;
}

#[derive(Debug, Default, Clone, Copy)]
pub struct ProductionClock;

impl Clock for ProductionClock {
    fn now_ms(&self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("el reloj del sistema está antes de UNIX_EPOCH")
            .as_millis() as u64
    }
}

/// Reloj controlado manualmente para el Simulation Engine (Sección 25).
/// `advance_ms`/`set_ms` permiten que los escenarios de simulación corran
/// a velocidad 1x/2x/5x/10x/60x sin depender del reloj real del sistema.
#[derive(Debug, Clone)]
pub struct SimulationClock {
    now_ms: Arc<AtomicU64>,
}

impl SimulationClock {
    pub fn new(start_ms: u64) -> Self {
        Self {
            now_ms: Arc::new(AtomicU64::new(start_ms)),
        }
    }

    pub fn advance_ms(&self, delta_ms: u64) {
        self.now_ms.fetch_add(delta_ms, Ordering::SeqCst);
    }

    pub fn set_ms(&self, value_ms: u64) {
        self.now_ms.store(value_ms, Ordering::SeqCst);
    }
}

impl Clock for SimulationClock {
    fn now_ms(&self) -> u64 {
        self.now_ms.load(Ordering::SeqCst)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn production_clock_devuelve_tiempo_creciente() {
        let clock = ProductionClock;
        let t1 = clock.now_ms();
        std::thread::sleep(std::time::Duration::from_millis(5));
        let t2 = clock.now_ms();
        assert!(t2 >= t1);
    }

    #[test]
    fn simulation_clock_avanza_manualmente() {
        let clock = SimulationClock::new(1_000);
        assert_eq!(clock.now_ms(), 1_000);
        clock.advance_ms(500);
        assert_eq!(clock.now_ms(), 1_500);
        clock.set_ms(10_000);
        assert_eq!(clock.now_ms(), 10_000);
    }

    #[test]
    fn simulation_clock_clonado_comparte_estado() {
        // Regla #67: Simulation debe poder compartir el mismo reloj entre
        // el motor y sus consumidores (Timer, Event Bus, etc.) vía Arc.
        let clock = SimulationClock::new(0);
        let shared = clock.clone();
        clock.advance_ms(100);
        assert_eq!(shared.now_ms(), 100);
    }
}

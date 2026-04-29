// ==================== CONFIGURACIÓN DEL JUEGO ====================

// Dimensiones de la arena
export const ARENA = {
    WIDTH: 600,
    HEIGHT: 600,
    RADIUS: 200
};

// Configuración de jugadores
export const PLAYER = {
    RADIUS: 30,
    MAX_LIVES: 7,
    SPEED: 4,                       // Velocidad constante
    FRICTION: 1.0,                  // Sin fricción (velocidad constante)
    MASS: 1                         // Masa igual para ambos jugadores
};

// Configuración de armas
export const WEAPONS = {
    BAZOOKA: {
        TYPE: 'B',
        NAME: 'Bazuca',
        FIRE_INTERVAL: 1000,      // Dispara cada 2 segundos
        USES: 1,
        PROJECTILE_DAMAGE: 3,
        PROJECTILE_SPEED: 7,
        PROJECTILE_MAX_DISTANCE: 400,
        PROJECTILE_RADIUS: 6,
        OFFSET_FROM_PLAYER: 25    // Distancia del arma respecto al jugador
    },
    SPIKE_SHIELD: {
        TYPE: 'C',
        NAME: 'Escudo de pinchos',
        USES: 3,
        CONTACT_DAMAGE: 1,
        CONTACT_COOLDOWN_MS: 450,
        SPIKE_COUNT: 12,
        SPIKE_LENGTH: 7,
        RING_PADDING: 4
    },
    SHOTGUN: {
        TYPE: 'E',
        NAME: 'Escopeta',
        FIRE_INTERVAL: 1000,
        USES: 1,
        PELLETS: 5,
        SPREAD_ANGLE: 0.7,
        PROJECTILE_DAMAGE: 1,
        PROJECTILE_SPEED: 8,
        PROJECTILE_MAX_DISTANCE: 300,
        PROJECTILE_RADIUS: 5,
        OFFSET_FROM_PLAYER: 25
    },
    SMG: {
        TYPE: 'M',
        NAME: 'Metralleta',
        BURST_INTERVAL: 1000,
        USES: 1,
        BURST_SHOTS: 3,
        SHOT_DELAY: 170,
        PROJECTILE_DAMAGE: 1,
        PROJECTILE_SPEED: 9,
        PROJECTILE_MAX_DISTANCE: 320,
        PROJECTILE_RADIUS: 4,
        OFFSET_FROM_PLAYER: 24
    }
};

// Configuración de spawn de armas
export const WEAPON_SPAWN = {
    INTERVAL: 3000,              // Cada 3 segundos
    LIFETIME: 10000,             // Duran 10 segundos en el suelo
    SPAWN_DISTANCE: 150          // Distancia desde el centro donde aparecen
};

// Configuración de colisiones
export const COLLISION = {
    WALL_RESTITUTION: 0.85,          // Coeficiente de restitución para rebote en pared (0-1)
    PLAYER_RESTITUTION: 0.9,         // Coeficiente de restitución entre jugadores
    FRICTION_FACTOR: 0.98            // Factor de fricción al rebotar
};

// Anti-loop para evitar trayectorias periodicas eternas
export const LOOP_BREAKER = {
    STABLE_HEADING_FRAMES: 220,
    WALL_MIN_DEFLECTION_RAD: 0.015,
    WALL_DEFLECTION_RAD: 0.08,
    PLAYER_COLLISION_DEFLECTION_RAD: 0.12,
    LOOP_DEFLECTION_RAD: 0.2
};

// Eventos especiales
export const EVENTS = {
    HEART: {
        TYPE: 'H',
        HEAL_AMOUNT: 2
    },
    TIME: {
        TYPE: 'T',
        FREEZE_DURATION_MS: 3000
    }
};

export const EVENT_SPAWN = {
    INTERVAL: 7000,
    LIFETIME: 9000
};

// Configuración de projectiles
export const PROJECTILE = {
    COLOR: '#FF6347',
    STROKE_COLOR: 'rgba(255, 255, 255, 0.7)',
    LINE_WIDTH: 1
};

// Configuración visual
export const VISUAL = {
    PLAYER_STROKE_COLOR: 'rgba(255, 255, 255, 0.5)',
    PLAYER_STROKE_WIDTH: 2,
    ARENA_BORDER_COLOR: '#333',
    ARENA_BORDER_WIDTH: 3,
    ARENA_BACKGROUND: 'rgba(135, 206, 235, 0.3)',
    DIRECTION_INDICATOR_RADIUS: 4
};

// Colores de armas
export const WEAPON_COLORS = {
    'B': '#FFD700',   // Oro para bazuca
    'C': '#FF69B4',   // Rosa para escudo de pinchos
    'E': '#8FBC8F',   // Verde para escopeta
    'M': '#87CEFA'    // Azul claro para metralleta
};

export const EVENT_COLORS = {
    'H': '#ff6b81',   // Corazon
    'T': '#74c0fc'    // Tiempo
};

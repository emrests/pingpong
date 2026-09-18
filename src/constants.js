export const TABLE = { length: 2.74, width: 1.525, height: 0.76 };
export const NET_HEIGHT = 0.1525;
export const NET_OVERHANG = 0.1525;
export const BALL_RADIUS = 0.02;

export const DT = 1 / 240;
export const GRAVITY = 9.81;
export const DRAG_K = 0.12; // a = -DRAG_K * |v| * v
export const MAGNUS_K = 0.0012; // a = MAGNUS_K * (spin x vel)
export const RESTITUTION = 0.9;
export const FRICTION = 0.25;
export const SIDE_KICK = 0.06; // lateral bounce kick from vertical-axis spin

export const MIN_SPEED = 4.5;
export const MAX_SPEED = 20;
export const POWER_GAIN = 2; // ball speed gained per m/s of forward swing
export const AIM_GAIN = 0.25; // target x shift per m/s of lateral swing
export const MAX_TOPSPIN = 600;
export const MAX_BACKSPIN = 480;
export const MAX_SIDESPIN = 400;

export const MOUSE_SENS = 0.0022; // metres per pixel
export const PADDLE_RADIUS = 0.085;
export const PADDLE_REACH = { x: 0.13, y: 0.17 };
export const PADDLE_BOUNDS = { xMin: -1.3, xMax: 1.3, zMin: 0.5, zMax: 2.3 };
export const PADDLE_HOME = { x: 0, y: 1.0, z: 1.7 };

export const TOSS_SPEED = 3.8; // ~0.7 m up, ~0.75 s in the air: enough time to swing with the camera
export const TOSS_TIMEOUT = 1.6;
export const POINT_PAUSE = 1.2;
export const RALLY_TIMEOUT = 8; // a live rally without a hit for this long is replayed as a let
export const WIN_SCORE = 11;

export const AI_SPEED = 2.8;
export const AI_ERROR = 0.09;

/** 宠物状态 ID */
export const STATE_IDS = ['idle', 'walk', 'click', 'sleep', 'follow']

/** 状态中文名，用于设置面板展示 */
export const STATE_LABELS = {
  idle: '待机',
  walk: '走路',
  click: '点击',
  sleep: '睡觉',
  follow: '跟随',
}

/** 状态优先级，数值越大越优先 */
export const STATE_PRIORITY = {
  idle: 0,
  walk: 20,
  follow: 40,
  sleep: 30,
  click: 100,
}

/** 默认行为参数 */
export const DEFAULT_BEHAVIOR_OPTIONS = {
  walkIntervalMin: 15000,
  walkIntervalMax: 30000,
  walkDuration: 5000,
  sleepIntervalMin: 60000,
  sleepIntervalMax: 120000,
  followDistance: 150,
  walkSpeed: 2,
  followSpeed: 1.5,
}

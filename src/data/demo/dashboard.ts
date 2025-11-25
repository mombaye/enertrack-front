export const gridRows = [
{ m: "Jan", grid_kwh: 6822, efms_kwh: 14092, target_kwh: 4068 },
{ m: "Feb", grid_kwh: 0, efms_kwh: 0, target_kwh: 4068 },
{ m: "Mar", grid_kwh: 7145, efms_kwh: 13685, target_kwh: 4068 },
{ m: "Apr", grid_kwh: 0, efms_kwh: 0, target_kwh: 4068 },
{ m: "May", grid_kwh: 0, efms_kwh: 0, target_kwh: 4068 },
{ m: "Jun", grid_kwh: 0, efms_kwh: 0, target_kwh: 4068 },
{ m: "Jul", grid_kwh: 5405, efms_kwh: 0, target_kwh: 4068 },
{ m: "Aug", grid_kwh: 2338, efms_kwh: 0, target_kwh: 4068 },
{ m: "Sep", grid_kwh: 4283, efms_kwh: 0, target_kwh: 4068 },
{ m: "Oct", grid_kwh: 1475, efms_kwh: 0, target_kwh: 4068 },
{ m: "Nov", grid_kwh: 5096, efms_kwh: 0, target_kwh: 4068 },
{ m: "Dec", grid_kwh: 845, efms_kwh: 0, target_kwh: 4068 },
];
export const solarRows = [
{ m: "Jan", kwh: 0, pct: 0 },
{ m: "Feb", kwh: 0, pct: 0 },
{ m: "Mar", kwh: 0, pct: 0 },
{ m: "Apr", kwh: 0, pct: 0 },
{ m: "May", kwh: 0, pct: 0 },
{ m: "Jun", kwh: 0, pct: 0 },
{ m: "Jul", kwh: 200, pct: 12 },
{ m: "Aug", kwh: 527, pct: 35 },
{ m: "Sep", kwh: 725, pct: 49 },
{ m: "Oct", kwh: 1010, pct: 68 },
{ m: "Nov", kwh: 1239, pct: 85 },
{ m: "Dec", kwh: 969, pct: 65 },
];
export const energyRows = [
{ m: "Jan", grid: 100, solar: 0, dg: 0 },
{ m: "Feb", grid: 100, solar: 0, dg: 0 },
{ m: "Mar", grid: 100, solar: 0, dg: 0 },
{ m: "Apr", grid: 0, solar: 0, dg: 0 },
{ m: "May", grid: 0, solar: 0, dg: 0 },
{ m: "Jun", grid: 0, solar: 0, dg: 0 },
{ m: "Jul", grid: 82, solar: 18, dg: 0 },
{ m: "Aug", grid: 76, solar: 24, dg: 0 },
{ m: "Sep", grid: 59, solar: 41, dg: 0 },
{ m: "Oct", grid: 29, solar: 71, dg: 0 },
{ m: "Nov", grid: 47, solar: 53, dg: 0 },
{ m: "Dec", grid: 47, solar: 53, dg: 0 },
];
export const siteInfo = {
id: "DBL_0101",
name: "BAMBEY_SERERE",
targetTypo: "A_Ax_GG S2",
actualTypo: "A_Ax_GG S2",
activationLoad: 7500,
avgLoad: 8000,
};

// 5) Dataset de comparaison : Evolution solaire vs Redevance (réel vs estimation Senelec)
// Montants en XOF (Franc CFA), valeurs de démo plausibles
export const compareRows = [
{ m: "Jan", solar_pct: 0, redev_est: 4000000, redev_real: 3900000 },
{ m: "Feb", solar_pct: 0, redev_est: 4000000, redev_real: 3800000 },
{ m: "Mar", solar_pct: 0, redev_est: 4000000, redev_real: 3700000 },
{ m: "Apr", solar_pct: 0, redev_est: 4000000, redev_real: 3600000 },
{ m: "May", solar_pct: 0, redev_est: 4000000, redev_real: 3500000 },
{ m: "Jun", solar_pct: 0, redev_est: 4000000, redev_real: 3400000 },
{ m: "Jul", solar_pct: 12, redev_est: 4000000, redev_real: 3200000 },
{ m: "Aug", solar_pct: 35, redev_est: 4000000, redev_real: 2600000 },
{ m: "Sep", solar_pct: 49, redev_est: 4000000, redev_real: 2300000 },
{ m: "Oct", solar_pct: 68, redev_est: 4000000, redev_real: 1800000 },
{ m: "Nov", solar_pct: 85, redev_est: 4000000, redev_real: 1400000 },
{ m: "Dec", solar_pct: 65, redev_est: 4000000, redev_real: 1600000 },
];
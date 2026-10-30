// Physics and stored records stay in metres; convert only at the UI boundary.
export const mph = (metresPerSecond) => Math.round(Math.max(0, metresPerSecond) * 3600 / 1609.344);
export const miles = (metres) => (Math.max(0, metres) / 1609.344).toFixed(2) + ' mi';

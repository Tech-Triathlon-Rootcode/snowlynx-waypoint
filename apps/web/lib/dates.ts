export function formatDeliveryDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function nextOperatingDateAfter(date: string) {
  const candidate = new Date(`${date}T00:00:00Z`);
  do candidate.setUTCDate(candidate.getUTCDate() + 1);
  while (candidate.getUTCDay() === 0);
  return candidate.toISOString().slice(0, 10);
}

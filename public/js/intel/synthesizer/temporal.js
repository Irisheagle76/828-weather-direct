export const temporal = {

  today: [
    "Today,",
    "For today,",
    "Through today,",
    "Later today,"
  ],

  tomorrow: [
    "Tomorrow,",
    "For tomorrow,",
    "Heading into tomorrow,",
    "Looking ahead to tomorrow,"
  ],

  goldilocksToday: [
    "Today, everything lines up really nicely,",
    "Today, things come together well,",
    "Today, it’s about as good as it gets,"
  ],

  goldilocksTomorrow: [
    "Tomorrow, another really nice setup,",
    "Tomorrow, things come together again,",
    "Tomorrow, it’s shaping up to be a great day,"
  ],

  choose(dayType, isGoldilocks) {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    if (dayType === "today") {
      return pick(isGoldilocks ? this.goldilocksToday : this.today);
    }

    if (dayType === "tomorrow") {
      return pick(isGoldilocks ? this.goldilocksTomorrow : this.tomorrow);
    }

    return "Overall,";
  }
};
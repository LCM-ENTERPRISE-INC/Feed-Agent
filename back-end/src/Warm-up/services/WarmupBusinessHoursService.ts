export class WarmupBusinessHoursService {
  /**
   * Checks if the given date falls within the designated business hours.
   * Default business hours are 08:00 (8 AM) to 20:00 (8 PM).
   * 
   * @param date Optional date to check. Defaults to current server time.
   */
  static isBusinessHours(date: Date = new Date()): boolean {
    const currentHour = date.getHours();
    
    // Returns true if the hour is between 8 and 19 (which means up to 19:59:59).
    // As soon as it hits 20:xx, it returns false.
    return currentHour >= 8 && currentHour < 20;
  }
}

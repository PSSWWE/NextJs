export type AccountsPeriodType =
  | "month"
  | "last3month"
  | "last6month"
  | "year"
  | "financialyear"
  | "custom";

/**
 * Pure date range for accounts transaction filters (customer/vendor pages).
 * Used so period + dates update in one batch; avoids fetch-with-stale-dates races.
 */
export function computeDateRangeForPeriod(
  periodType: AccountsPeriodType,
  customStartDate: string,
  customEndDate: string
): { from: Date; to: Date } | undefined {
  const now = new Date();
  let startDate: Date;
  const endDate: Date = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );

  switch (periodType) {
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last3month": {
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      startDate = new Date(
        threeMonthsAgo.getFullYear(),
        threeMonthsAgo.getMonth(),
        1
      );
      break;
    }
    case "last6month": {
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      startDate = new Date(
        sixMonthsAgo.getFullYear(),
        sixMonthsAgo.getMonth(),
        1
      );
      break;
    }
    case "year": {
      const twelveMonthsAgo = new Date(now);
      twelveMonthsAgo.setMonth(now.getMonth() - 12);
      startDate = new Date(
        twelveMonthsAgo.getFullYear(),
        twelveMonthsAgo.getMonth(),
        twelveMonthsAgo.getDate()
      );
      break;
    }
    case "financialyear":
      if (now.getMonth() >= 6) {
        startDate = new Date(now.getFullYear(), 6, 1);
      } else {
        startDate = new Date(now.getFullYear() - 1, 6, 1);
      }
      break;
    case "custom":
      if (
        !customStartDate ||
        !customEndDate ||
        customStartDate.length !== 10 ||
        customEndDate.length !== 10
      ) {
        return undefined;
      }
      {
        const startDateObj = new Date(customStartDate);
        const endDateObj = new Date(customEndDate);
        if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
          return undefined;
        }
        const from = new Date(customStartDate);
        from.setHours(0, 0, 0, 0);
        const to = new Date(customEndDate);
        to.setHours(23, 59, 59, 999);
        return { from, to };
      }
    default: {
      const defaultThreeMonthsAgo = new Date(now);
      defaultThreeMonthsAgo.setMonth(now.getMonth() - 3);
      startDate = new Date(
        defaultThreeMonthsAgo.getFullYear(),
        defaultThreeMonthsAgo.getMonth(),
        1
      );
    }
  }

  return { from: startDate, to: endDate };
}

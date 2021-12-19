import { useState, useEffect, useCallback } from "react";
import jMoment from "moment-jalaali";
import {
  EVENTS,
  DATE_FORMATS,
  RANGE_SELECT_TYPES,
  RANGEPICKER_DAY_EXCLUSION_TYPES,
} from "../Constants";
import {
  generateMonth,
  getDateUnix,
  getUnixOfDate,
  convertDate,
  calcuateNextAndPrevMonth,
  computeDaysInRange,
  getWeekDayName,
} from "../utils";

const isWindow = typeof window === "object";

const RangePickerManager = (props) => {
  /**
   *
   * props Values
   */
  const {
    isJalaali,
    numberOfMonths,
    shouldDisableBeforeToday,
    appendExcludeWeekDays,
    onExcludeStatusChange,

    // event handlers
    onExclude,
    onChangeRange,
    onExcludeDaysSeqChange,

    //defaults
    defaultSelectedRange: {
      startDate: defaultStartDate,
      stopDate: defaultStopDate,
    },
    defaultExcludedDays,
  } = props;

  const isInitiatedWithDefaults = !!defaultStartDate && !!defaultStopDate;

  /**
   *
   * local States
   */
  const [visibleDatesRange, setVisibleDatesRange] = useState([]);
  const [isExcludedMode, setIsExcludedMode] = useState(false);
  const [isExclutionEnabled, setIsExclutionEnabled] = useState(true);
  const [selectedRange, setSelectedRange] = useState({
    startDate: null,
    stopDate: null,
  });
  const [excludedDaysSeq, setexcludedDaysSeq] = useState(appendExcludeWeekDays);
  const [computedSelectedRange, setComputedSelectedRange] = useState({});

  // DEFAULTS SETUP
  useEffect(() => {
    if (isInitiatedWithDefaults) {
      // default selected range
      const defaultSelectedRange = {
        startDate: defaultStartDate,
        stopDate: defaultStopDate,
      };

      setSelectedRange(defaultSelectedRange);

      // compute selected range
      const startDate = isJalaali
        ? defaultStartDate
        : convertDate({ date: defaultStartDate, isJalaali: true });
      const stopDate = isJalaali
        ? defaultStartDate
        : convertDate({ date: defaultStopDate, isJalaali: true });

      setComputedSelectedRange(
        computeDaysInRange({
          startDate,
          stopDate,
          isJalaali,
          defaultExcludedDays,
        })
      );

      // set extra stuff
      setIsExcludedMode(true);
      setIsExclutionEnabled(false);
    }
  }, [isInitiatedWithDefaults]);

  useEffect(() => {
    if (isInitiatedWithDefaults) {
      setComputedSelectedRange(
        computeDaysInRange({
          startDate: defaultStartDate,
          stopDate: defaultStopDate,
          isJalaali,
          defaultExcludedDays,
        })
      );
    }
  }, [defaultExcludedDays]);

  useEffect(() => {
    setexcludedDaysSeq(appendExcludeWeekDays);
  }, [appendExcludeWeekDays]);
  // ------------------------------------------------

  /**
   *
   * Event listeners
   * TODO:
   *  -
   */
  useEffect(() => {
    if (isWindow) {
      window.addEventListener(EVENTS.RANGE_PICKER.CLEAR, onClearFunction);
      window.addEventListener(
        EVENTS.RANGE_PICKER.TOGGLE_EXCLUDE_MODE,
        handleExcludeMode
      );
  
      return () => {
        window.removeEventListener(EVENTS.RANGE_PICKER.CLEAR, onClearFunction);
        window.removeEventListener(
          EVENTS.RANGE_PICKER.TOGGLE_EXCLUDE_MODE,
          handleExcludeMode
        );
      };
    }
  }, []);

  /**
   *
   * Effects
   */

  useEffect(() => {
    const today = new Date();

    const datesRange = generateMonth({
      indexDate: today,
      numberOfMonths,
      isJalaali,
    });

    setVisibleDatesRange(datesRange);

    // convert selectedRange and update it
    let { convertedStartDate, convertedStopDate } = convertSelectedRange(
      selectedRange
    );

    setSelectedRange({
      startDate: convertedStartDate,
      stopDate: convertedStopDate,
    });

    // convert computedSelectedRange and update it
    setComputedSelectedRange((computedSelectedRange) => {
      return manageComputedSelectedRange({
        oldState: computedSelectedRange,
        newState: computeDaysInRange({
          startDate: convertedStartDate,
          stopDate: convertedStopDate,
          isJalaali,
        }),
      });
    });

    // AWARE OUTSIDE
    onChangeRange({
      startDate: convertedStartDate,
      stopDate: convertedStopDate,
    });
  }, [isJalaali]);

  /**
   * ON Number of month change
   */
  useEffect(() => {
    const today = new Date();

    const datesRange = generateMonth({
      indexDate: today,
      numberOfMonths,
      isJalaali,
    });

    setVisibleDatesRange(datesRange);

    setSelectedRange(selectedRange);
  }, [numberOfMonths]);

  // exclude
  useEffect(() => {
    if (isExcludedMode) {
      const { BULK } = RANGEPICKER_DAY_EXCLUSION_TYPES;
      const { JALAALI_DATE_FORMAT, GEORGIAN_DATE_FORMAT } = DATE_FORMATS;

      const ONE_DAY_IN_UNIX = 24 * 60 * 60;

      const { startDate, stopDate } = selectedRange;
      const startDate_unix = getDateUnix({ date: startDate, isJalaali });
      const stopDate_unix = getDateUnix({ date: stopDate, isJalaali });

      const targetDaysTracer = [];

      for (
        let i = startDate_unix + ONE_DAY_IN_UNIX;
        i < stopDate_unix;
        i = i + ONE_DAY_IN_UNIX
      ) {
        const iterationDate = getUnixOfDate({ unix: i, isJalaali });
        const dayName = jMoment(
          iterationDate,
          isJalaali ? JALAALI_DATE_FORMAT : GEORGIAN_DATE_FORMAT
        ).format("dddd");

        const foundIndex = appendExcludeWeekDays.findIndex(
          (weekDay) => weekDay === dayName
        );

        if (foundIndex !== -1)
          targetDaysTracer.push(
            iterationDate
              .split("-")
              .map((el) => Number(el))
              .join("-")
          );
      }

      // console.log({ targetDaysTracer });

      setComputedSelectedRange((computedSelectedRange) =>
        toggleComputedSelectedRangeItems(
          computedSelectedRange,
          targetDaysTracer,
          BULK
        )
      );
    }
  }, [appendExcludeWeekDays, selectedRange]);

  /**
   *
   * AWARE OUTSIDE API
   */
  // api to aware user of exclude status change
  useEffect(() => {
    onExcludeStatusChange({ isExclutionEnabled, isExcludedMode });
  }, [isExclutionEnabled, isExcludedMode]);

  useEffect(() => {
    if (computedSelectedRange && isExcludedMode) {
      onExclude(getExcludedDays(computedSelectedRange));
    }
  }, [computedSelectedRange]);

  /**
   *
   * handlers
   */
  const handleNavigateMonth = useCallback(
    (e) => {
      const target = e.currentTarget.dataset.name;
      handlePrevAndNextMonth(target);
    },
    [visibleDatesRange]
  );

  const onSelectDate = useCallback(
    (...args) => {
      if (isExcludedMode && !isExclutionEnabled) {
        handleExcludeDays(...args);
      } else {
        updateSelectedRange(...args);
      }
    },
    [selectedRange, isExcludedMode, isExclutionEnabled, excludedDaysSeq]
  );

  const updateSelectedRange = useCallback(
    ({ e, year, month, day }) => {
      const { START_DATE, STOP_DATE } = RANGE_SELECT_TYPES;

      const { startDate, stopDate } = selectedRange;

      const targetDate = `${year}-${month}-${day}`;
      let resultedStartDate = startDate;
      let resultedStopDate = stopDate;

      let type;
      if (startDate !== null && stopDate !== null) {
        type = START_DATE;

        resultedStartDate = targetDate;
        resultedStopDate = null;
      } else if (startDate !== null) {
        const selectedDate_unix = getDateUnix({ date: targetDate, isJalaali });
        const startDate_unix = getDateUnix({ date: startDate, isJalaali });

        if (selectedDate_unix < startDate_unix) {
          type = START_DATE;

          resultedStartDate = targetDate;
          resultedStopDate = null;
        } else {
          type = STOP_DATE;
          // start remains the same value, no need to change it
          resultedStopDate = targetDate;
        }
      } else if (startDate == null) {
        type = START_DATE;

        resultedStartDate = targetDate;
        resultedStopDate = null;
      } else if (startDate !== null && stopDate == null) {
        type = STOP_DATE;

        // start remain the same
        resultedStopDate = targetDate;
      }

      // check for exclusion mode
      if (type === STOP_DATE && resultedStopDate !== null)
        setIsExclutionEnabled(false);
      else if (type === START_DATE) {
        setIsExclutionEnabled(true);
        setIsExcludedMode(false);
        setComputedSelectedRange({});
        onExclude([]);
      }

      // set State
      setSelectedRange({
        startDate: resultedStartDate,
        stopDate: resultedStopDate,
      });

      if (resultedStartDate !== null && resultedStopDate !== null) {
        setComputedSelectedRange(
          computeDaysInRange({
            startDate: resultedStartDate,
            stopDate: resultedStopDate,
            isJalaali,
          })
        );
      }

      // AWARE OUTSIDE
      onChangeRange({
        startDate: resultedStartDate,
        stopDate: resultedStopDate,
      });
    },
    [selectedRange]
  );

  const handleExcludeDays = useCallback(
    (args) => {
      const { e, year, month, day } = args;
      const { startDate, stopDate } = selectedRange;

      const { SINGLE } = RANGEPICKER_DAY_EXCLUSION_TYPES;

      const date = `${year}-${month}-${day}`;

      const currentDateUnix = getDateUnix({ date, isJalaali });
      const startDateUnix = getDateUnix({ date: startDate, isJalaali });
      const stopDateUnix = getDateUnix({ date: stopDate, isJalaali });

      if (currentDateUnix <= startDateUnix || currentDateUnix >= stopDateUnix)
        return;

      // check if excludedDaysSeq has the day name
      // aware it to delete the week day
      const weekDayName = getWeekDayName({ date, isJalaali });
      const foundIndex = excludedDaysSeq.findIndex((el) => el === weekDayName);

      if (foundIndex !== -1) {
        onExcludeDaysSeqChange(weekDayName);

        let tracer = [];
        Object.keys(computedSelectedRange)
          .splice(1, Object.keys(computedSelectedRange).length - 2) // extract first and last day
          .forEach((day) => {
            const dayName = getWeekDayName({ date: day, isJalaali });
            if (dayName === weekDayName) tracer.push(day);
          });

        tracer = tracer.filter((el) => el !== date);

        const newComputed = { ...computedSelectedRange };

        tracer.forEach((__day) => {
          newComputed[__day] = {
            isIncluded: false,
            forceIncluded: false,
            isInSequence: false,
          };
        });

        setComputedSelectedRange(newComputed);
        return;
      }

      setComputedSelectedRange((computedSelectedRange) =>
        toggleComputedSelectedRangeItems(computedSelectedRange, [date], SINGLE)
      );
    },
    [selectedRange, computedSelectedRange]
  );

  /**
   *
   * Custome Event Dispatche Functions
   */
  const onClearFunction = useCallback(() => {
    setSelectedRange({ startDate: null, stopDate: null });
    setIsExclutionEnabled(true);
    setIsExcludedMode(false);
    setComputedSelectedRange({});

    onExclude([]);
    onChangeRange({ startDate: null, stopDate: null });
  }, [computedSelectedRange]);

  const handleExcludeMode = useCallback(
    (event) => {
      setIsExcludedMode(event.detail.isExcludedMode);
    },
    [setIsExcludedMode, selectedRange]
  );

  /**
   *
   * privateFuncs
   */
  const handlePrevAndNextMonth = (type) => {
    const monthId = Object.keys(visibleDatesRange)[0];

    const calculatedNextMonth =
      type === "NEXT" ? numberOfMonths : numberOfMonths * -1;

    const resultDate = calcuateNextAndPrevMonth({
      monthId,
      isJalaali,
      numberOfMonths: calculatedNextMonth,
    });

    setVisibleDatesRange(
      generateMonth({
        indexDate: new Date(resultDate),
        numberOfMonths,
        isJalaali,
      })
    );
  };

  const toggleComputedSelectedRangeItems = (
    oldState,
    dates,
    type = RANGEPICKER_DAY_EXCLUSION_TYPES.SINGLE
  ) => {
    // console.log("OLD -->>>", { oldState });

    const { SINGLE, BULK } = RANGEPICKER_DAY_EXCLUSION_TYPES;

    let newState = {};

    Object.entries(oldState).forEach(([date, state]) => {
      const isExsists = dates.some((dt) => dt === date);

      if (isExsists && type === SINGLE) {
        state.isIncluded = !state.isIncluded;
        if (state.isInSequence && state.isIncluded) {
          state.forceIncluded = true;
        }
        Object.assign(newState, { [date]: state });
      } else if (!isExsists && type === BULK && state.isInSequence) {
        state.isIncluded = true;
        state.isInSequence = false;
        if (state.forceIncluded) {
          state.forceIncluded = false;
        }
        Object.assign(newState, { [date]: state });
      } else if (isExsists) {
        state.isIncluded = false;
        if (type === BULK) {
          state.isInSequence = true;
          if (state.forceIncluded) {
            state.isIncluded = true;
            state.forceIncluded = true;
          }
        }
        Object.assign(newState, { [date]: state });
      }
    });

    // console.log("NEW STATE", { newState });

    return { ...oldState, ...newState };
  };

  const convertSelectedRange = ({ startDate, stopDate }) => {
    let convertedStartDate = null;
    let convertedStopDate = null;

    if (startDate) {
      convertedStartDate = convertDate({
        date: startDate,
        isJalaali: !isJalaali,
      });

      if (stopDate) {
        convertedStopDate = convertDate({
          date: stopDate,
          isJalaali: !isJalaali,
        });
      }
    }

    return { convertedStartDate, convertedStopDate };
  };

  const manageComputedSelectedRange = ({ oldState, newState }) => {
    if (oldState == null || newState == null) return;

    const result = {};
    Object.entries(newState).forEach(([key, value], i) => {
      return (result[key] = Object.values(oldState)[i]);
    });

    return result;
  };

  const getExcludedDays = (computedDays) => {
    return Object.entries(computedDays)
      .filter(
        ([date, { isIncluded, forceIncluded, isInSequence }]) =>
          !isIncluded && !forceIncluded
      )
      .map(([date]) => date);
  };

  /**
   *
   * return the result
   */
  return {
    data: {
      isJalaali,
      visibleDatesRange,
      selectedRange,
      isExcludedMode,
      shouldDisableBeforeToday,
      computedSelectedRange,
    },
    actions: { handleNavigateMonth, onSelectDate },
  };
};

export default RangePickerManager;

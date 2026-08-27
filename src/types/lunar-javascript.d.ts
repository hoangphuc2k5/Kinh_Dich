declare module 'lunar-javascript' {
  export const Solar: {
    fromYmd(year: number, month: number, day: number): {
      getLunar(): {
        getYearZhiIndex(): number;
        getMonth(): number;
        getDay(): number;
      };
    };
  };
}
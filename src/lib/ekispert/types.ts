/**
 * 駅すぱあと API のレスポンスのうち、このアプリが使うフィールドだけを宣言する。
 *
 * 仕様の正本は https://docs.ekispert.com/v1/le/ （フリープラン）。
 * 全部を写すと向こうの変更のたびに追従が要るため、使う範囲に絞っている。
 */

/** 検索して選んだ駅。DBにもこの形で控える。 */
export interface StationRef {
  /** 駅すぱあとの駅コード。 */
  code: string;
  name: string;
}

/** 駅検索の結果1件。 */
export interface StationHit extends StationRef {
  yomi: string | null;
  /** 都道府県名。同名駅を見分けるために出す。 */
  prefecture: string | null;
}

/** 運行路線の検索結果1件。 */
export interface OperationLineHit {
  code: string;
  name: string;
  /** 会社名。駅すぱあとが会社名を返さない場合は null。 */
  operator: string | null;
}

/** `/search/course/light` の探索条件。 */
export interface CourseUrlQuery {
  from: StationRef;
  to: StationRef;
  via?: StationRef | null;
  /** `YYYYMMDD`。省略すると駅すぱあと側の現在日付になる。 */
  date?: string;
  /** `HHMM`。省略すると駅すぱあと側の現在時刻になる。 */
  time?: string;
  searchType?: "departure" | "arrival" | "lastTrain" | "firstTrain";
}

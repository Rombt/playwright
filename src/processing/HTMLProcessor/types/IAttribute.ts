export interface IAttribute {
  key: string | null; // уникальный идентификатор атрибута, если нужен
  name: string; // человекочитаемое имя
  value: string; // человекочитаемое значение
  rawName: string; // исходное имя из HTML
  rawValue: string; // исходное значение из HTML
}

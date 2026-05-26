export interface IActionResult<TMeta = unknown> {
  success: boolean;
  error?: unknown;
  meta?: TMeta;
}

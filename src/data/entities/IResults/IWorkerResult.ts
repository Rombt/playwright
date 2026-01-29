import { IWorkerError } from "../IErrors/IWorkerError";

export interface IWorkerResult { data: unknown[];  errors: IWorkerError[]; }
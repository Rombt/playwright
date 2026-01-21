import { Task } from "../contracts/Task";

export interface Scenario {
  run(task: Task): Promise<void>;
}
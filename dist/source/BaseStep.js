"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseStep = void 0;
class BaseStep {
    async run(ctx) {
        ctx.logger.debug('Step run', {
            step: this.name,
            stage: 'process',
        });
        await this.execute(ctx);
    }
}
exports.BaseStep = BaseStep;

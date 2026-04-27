"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseStep = void 0;
class BaseStep {
    async run(ctx, config, params) {
        ctx.logger.debug('Step run', {
            step: this.name,
            stage: 'process',
            params,
        });
        await this.execute(ctx, config, params);
    }
}
exports.BaseStep = BaseStep;

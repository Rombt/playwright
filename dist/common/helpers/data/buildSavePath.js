"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSaveName = buildSaveName;
exports.buildSaveDir = buildSaveDir;
/**

 */
function buildSaveName(saveNamePattern, task) {
    return saveNamePattern.replace(/\$\{([^\}]+)\}/g, (_, key) => {
        const keys = key.split('.');
        let value = task;
        for (const k of keys) {
            if (value == null)
                return '';
            value = value[k];
        }
        return value != null ? String(value) : '';
    });
}
function buildSaveDir(saveDirPattern, task) {
    return saveDirPattern.replace(/\$\{([^\}]+)\}/g, (_, key) => {
        const keys = key.split('.');
        let value = task;
        for (const k of keys) {
            if (value == null)
                return '';
            value = value[k];
        }
        return value != null ? String(value) : '';
    });
}

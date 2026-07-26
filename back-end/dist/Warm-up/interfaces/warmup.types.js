"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupStatus = exports.WarmupPhase = void 0;
var WarmupPhase;
(function (WarmupPhase) {
    WarmupPhase["PHASE_1"] = "PHASE_1";
    WarmupPhase["PHASE_2"] = "PHASE_2";
    WarmupPhase["PHASE_3"] = "PHASE_3";
})(WarmupPhase || (exports.WarmupPhase = WarmupPhase = {}));
var WarmupStatus;
(function (WarmupStatus) {
    WarmupStatus["IDLE"] = "IDLE";
    WarmupStatus["WARMING"] = "WARMING";
    WarmupStatus["COOLING_DOWN"] = "COOLING_DOWN";
    WarmupStatus["PAUSED"] = "PAUSED";
    WarmupStatus["BANNED"] = "BANNED";
    WarmupStatus["COMPLETED"] = "COMPLETED";
})(WarmupStatus || (exports.WarmupStatus = WarmupStatus = {}));

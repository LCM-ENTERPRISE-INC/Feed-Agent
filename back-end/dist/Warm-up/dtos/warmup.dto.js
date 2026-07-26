"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateWarmupProfileDto = exports.CreateWarmupProfileDto = void 0;
class CreateWarmupProfileDto {
    instanceId;
    name;
    initialPhase;
}
exports.CreateWarmupProfileDto = CreateWarmupProfileDto;
class UpdateWarmupProfileDto {
    name;
    currentPhase;
    dailyLimit;
}
exports.UpdateWarmupProfileDto = UpdateWarmupProfileDto;

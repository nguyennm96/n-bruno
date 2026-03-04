"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentService = exports.CollectionService = exports.WorkspaceService = exports.AuthService = exports.BrunoApiClient = void 0;
exports.createBrunoApi = createBrunoApi;
var client_1 = require("./client");
Object.defineProperty(exports, "BrunoApiClient", { enumerable: true, get: function () { return client_1.BrunoApiClient; } });
var auth_1 = require("./auth");
Object.defineProperty(exports, "AuthService", { enumerable: true, get: function () { return auth_1.AuthService; } });
var workspaces_1 = require("./workspaces");
Object.defineProperty(exports, "WorkspaceService", { enumerable: true, get: function () { return workspaces_1.WorkspaceService; } });
var collections_1 = require("./collections");
Object.defineProperty(exports, "CollectionService", { enumerable: true, get: function () { return collections_1.CollectionService; } });
var environments_1 = require("./environments");
Object.defineProperty(exports, "EnvironmentService", { enumerable: true, get: function () { return environments_1.EnvironmentService; } });
__exportStar(require("./types"), exports);
// Re-export for convenience
const client_2 = require("./client");
const auth_2 = require("./auth");
const workspaces_2 = require("./workspaces");
const collections_2 = require("./collections");
const environments_2 = require("./environments");
/**
 * Create a configured Bruno API instance
 */
function createBrunoApi(config) {
    const client = new client_2.BrunoApiClient(config);
    const auth = new auth_2.AuthService(client);
    const workspaces = new workspaces_2.WorkspaceService(client);
    const collections = new collections_2.CollectionService(client);
    const environments = new environments_2.EnvironmentService(client);
    return {
        client,
        auth,
        workspaces,
        collections,
        environments,
    };
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HappilyaiApi = void 0;
class HappilyaiApi {
    constructor() {
        this.name = "happilyaiApi";
        this.displayName = "HappilyAI API";
        this.documentationUrl = "https://api.happily.ai/prod";
        this.icon = {
            light: "file:../nodes/Happilyai/happilyai.svg",
            dark: "file:../nodes/Happilyai/happilyai.dark.svg"
        };
        this.properties = [
            {
                displayName: "x-api-key",
                name: "secret",
                type: "string",
                typeOptions: {
                    password: true
                },
                default: "",
                required: true
            }
        ];
        this.authenticate = {
            type: "generic",
            properties: {
                headers: {
                    "x-api-key": "={{$credentials.secret}}"
                }
            }
        };
        this.test = {
            request: {
                baseURL: "https://api.happily.ai/prod",
                url: "/1/members"
            }
        };
    }
}
exports.HappilyaiApi = HappilyaiApi;
//# sourceMappingURL=HappilyaiApi.credentials.js.map
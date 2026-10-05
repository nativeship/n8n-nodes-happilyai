import { type IAuthenticateGeneric, type Icon, type ICredentialTestRequest, type ICredentialType, type INodeProperties } from "n8n-workflow";

// Generated with ts-morph
export class HappilyaiApi implements ICredentialType {
  name = "happilyaiApi";
  displayName = "HappilyAI API";
  documentationUrl = "https://api.happily.ai/prod";
  icon: Icon = {
        light: "file:../nodes/Happilyai/happilyai.svg",
        dark: "file:../nodes/Happilyai/happilyai.dark.svg"
    };
  properties: INodeProperties[] = [
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
  authenticate: IAuthenticateGeneric = {
        type: "generic",
        properties: {
            headers: {
                "x-api-key": "={{$credentials.secret}}"
            }
        }
    };
  test: ICredentialTestRequest = {
        request: {
            baseURL: "https://api.happily.ai/prod",
            url: "/1/members"
        }
    };
}

import { IClientGeneratorSettings } from "./client-generator-settings";
export interface IRestGenerator {
    generateClientServiceFromFile(tsClassFilePath: string, outputFile: string, settings?: IClientGeneratorSettings): string;
}

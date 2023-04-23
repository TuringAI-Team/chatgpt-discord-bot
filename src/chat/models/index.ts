import { HuggingFaceModel } from "./huggingface.js";
import { ReplicateModel } from "./replicate.js";
import { NatPlaygroundModel } from "./nat.js";
import { ChatGPTModel } from "./chatgpt.js";
import { ClydeModel } from "./clyde.js";
import { DummyModel } from "./dummy.js";
import { GPT3Model } from "./gpt-3.js";

export const ChatModels = [
    NatPlaygroundModel,
    HuggingFaceModel,
    ReplicateModel,
    ChatGPTModel,
    ClydeModel,
    DummyModel,
    GPT3Model
]
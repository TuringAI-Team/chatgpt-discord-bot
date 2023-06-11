export interface RunPodBLIP2Input {
    data_url: string;
}

export interface RunPodBLIP2Caption {
    caption: string;
    image_path: string;
}

export interface RunPodBLIP2Output {
    captions: [ RunPodBLIP2Caption ];
}
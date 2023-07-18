export const ImageSamplers = [
    "k_euler", "k_heun", "k_lms", "k_euler_a", "k_dpm_2", "k_dpm_2_a", "k_dpm_fast", "k_dpm_adaptive", "k_dpmpp_2m", "k_dpmpp_2s_a", "k_dpmpp_sde"
]

export type ImageSampler = typeof ImageSamplers[number]

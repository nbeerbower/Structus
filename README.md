# STRUCTUS
## Instruction-Following DPO Dataset Generator

Generate synthetic instruction-following datasets for Direct Preference Optimization (DPO) training. STRUCTUS creates pairs of formatted and unformatted responses to the same prompt, ideal for training language models to follow structural and formatting instructions.

Features:
- Generates prompts combining random tasks with formatting requirements
- Produces "chosen" (correctly formatted) and "rejected" (unformatted) responses
- Configurable task templates and variables via YAML
- Built for easy integration with DPO training pipelines
// ...existing code...
const handleModelChange = async (agentName: AgentNameEnum, modelValue: string) => {
  // Always use Azure OpenAI as provider, ignore user selection
  const provider = ProviderTypeEnum.AzureOpenAI;
  // Use the selected deployment/model name from the dropdown (after '>'), or fallback to modelValue
  const model = modelValue.includes('>') ? modelValue.split('>')[1] : modelValue;

  console.log(`[handleModelChange] Hardcoded AzureOpenAI for ${agentName}: provider=${provider}, model=${model}`);

  // Set parameters based on provider type
  const newParameters = getDefaultAgentModelParams(provider, agentName);

  setModelParameters(prev => ({
    ...prev,
    [agentName]: newParameters,
  }));

  // Store both provider and model name in the format "provider>model"
  setSelectedModels(prev => ({
    ...prev,
    [agentName]: `${provider}>${model}`, // Always AzureOpenAI
  }));

  try {
    if (model) {
      const providerConfig = providers[provider];

      // For Azure, verify the model is in the deployment names list
      if (providerConfig && providerConfig.type === ProviderTypeEnum.AzureOpenAI) {
        console.log(`[handleModelChange] Azure model selected: ${model}`);
      }

      // Reset reasoning effort if switching models
      if (isOpenAIReasoningModel(model)) {
        // Set default reasoning effort based on agent type
        const defaultReasoningEffort = agentName === AgentNameEnum.Planner ? 'low' : 'minimal';
        setReasoningEffort(prev => ({
          ...prev,
          [agentName]: prev[agentName] || defaultReasoningEffort,
        }));
      } else {
        // Clear reasoning effort for non-O-series models
        setReasoningEffort(prev => ({
          ...prev,
          [agentName]: undefined,
        }));
      }

      // For Anthropic Opus models, only pass temperature, not topP
      const parametersToSave = isAnthropicOpusModel(model)
        ? { temperature: newParameters.temperature }
        : newParameters;

      await agentModelStore.setAgentModel(agentName, {
        provider,
        modelName: model,
        parameters: parametersToSave,
        reasoningEffort: isOpenAIReasoningModel(model)
          ? reasoningEffort[agentName] || (agentName === AgentNameEnum.Planner ? 'low' : 'minimal')
          : undefined,
      });
    } else {
      // Reset storage if no model is selected
      await agentModelStore.resetAgentModel(agentName);
    }
  } catch (error) {
    console.error('Error saving agent model:', error);
  }
};
// ...existing code...
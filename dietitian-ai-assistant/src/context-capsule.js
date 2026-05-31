export function buildClientContextCapsule({
  tenantId,
  dietitian,
  client,
  conversation,
  persona,
  voiceProfile,
  memory,
}) {
  assertTenantIsolation({ tenantId, dietitian, client, conversation });

  return {
    tenantId,
    dietitian: {
      id: dietitian.id,
      displayName: dietitian.displayName,
      timezone: dietitian.timezone,
    },
    client: {
      id: client.id,
      fullName: client.fullName,
      communicationLanguage: client.communicationLanguage || client.healthProfile?.preferredLanguage || "tr",
      healthProfile: client.healthProfile || {},
      dietPlan: client.dietPlan || {},
      allergies: client.allergies || [],
      restrictedFoods: client.restrictedFoods || [],
      clinicalRiskNotes: client.clinicalRiskNotes || [],
      pinnedNotes: client.pinnedNotes || [],
      clientFormSummary: client.clientFormSummary || "",
      contextUpdates: client.contextUpdates || [],
      aiMode: client.aiMode,
      aiStatus: client.aiStatus || "passive",
      aiActiveFrom: client.aiActiveFrom || null,
      aiActiveUntil: client.aiActiveUntil || null,
      contextRevision: client.contextRevision || 1,
    },
    conversation: {
      id: conversation.id,
      channel: conversation.channel,
    },
    persona,
    voiceProfile,
    memory,
  };
}

export function assertTenantIsolation({ tenantId, dietitian, client, conversation }) {
  const records = [
    ["dietitian", dietitian],
    ["client", client],
    ["conversation", conversation],
  ];

  for (const [label, record] of records) {
    if (!record || record.tenantId !== tenantId) {
      throw new Error(`Tenant isolation failed for ${label}`);
    }
  }

  if (client.dietitianId !== dietitian.id) {
    throw new Error("Client does not belong to the selected dietitian");
  }

  if (conversation.clientId !== client.id || conversation.dietitianId !== dietitian.id) {
    throw new Error("Conversation does not match client and dietitian");
  }
}

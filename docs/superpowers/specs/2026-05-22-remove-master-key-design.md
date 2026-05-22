# Remove master key and provider config encryption

## Goal

Remove the master key flow and stop encrypting provider API keys. OpenAI and OpenRouter configs should save and load directly without prompting for a master key. Existing encrypted data, migration, and backward compatibility are explicitly out of scope because there are no users and no data to preserve.

## Scope

In scope:
- Remove master key gating from provider configuration flows
- Store provider config as plain local JSON
- Auto-load provider config without unlock steps
- Delete master key setup, unlock, and migration UI/code paths
- Update project documentation to reflect the new storage behavior

Out of scope:
- Any migration from legacy/master-key encrypted records
- Preserving or converting existing encrypted data
- Adding OS keychain or browser secure storage

## Current problem

Provider configuration is coupled to the master key abstraction:
- `src/utils/master-key.ts` owns save/load logic for provider configs
- `src/main/modules/llm/components/OpenAITab.tsx` and `src/main/modules/llm/components/OpenRouterTab.tsx` block saving/loading on master key state
- setup and migration dialogs exist only to support this encryption path
- restore logic assumes encrypted provider records that require unlock state

This is needless friction for the current product state and should be removed completely rather than patched around.

## Recommended approach

Use ordinary local persistence for provider configs and delete the master key/encryption path.

Short-term storage can continue to use the existing provider records if that is the narrowest code change, but the runtime semantics must be plain storage:
- provider configs are written as ordinary JSON strings
- provider configs are read directly without decrypt/unlock steps
- no code path may require `hasMasterKey`, `isMasterKeyUnlocked`, or passkey entry

The important change is not where bytes land, but that the application model stops pretending provider config storage is encrypted.

## Design

### Storage

Provider config remains keyed by provider name:
- `openai_config`
- `openrouter_config`

Stored payload shape:

```json
{
  "apiKey": "...",
  "baseUrl": "..."
}
```

Requirements:
- save writes the JSON payload directly
- load parses the JSON payload directly
- no `advancedSeed`
- no `master_encryption_key`
- no restore path that depends on decrypted master material

If the existing `encryptions` table is reused as a transport container, that is an implementation detail only. The code and docs must describe this as plain provider config storage, not encryption.

### UI behavior

For both provider tabs:
- save config immediately when required fields are present
- create the provider service immediately after save
- load config directly from local storage
- mark provider ready without any unlock step
- on restart, if config exists, provider can be restored directly

Remove these behaviors entirely:
- prompting to create a master key
- refusing to save because master key is locked
- refusing to load because master key is locked
- migration prompts or passkey collection

### Code removal

Delete or stop using these master-key-specific surfaces:
- `src/utils/master-key.ts`
- `src/utils/auth-provider-restore.ts`
- `src/utils/provider-passkey-unlock.ts`
- `src/main/components/molecules/MasterKeySetupDialog.tsx`
- `src/main/components/molecules/MigrationWizard.tsx`
- `src/main/hooks/use-master-key.ts`
- related i18n strings and conditional UI branches

If a file still exists after the change, it must have a real caller and a real purpose. No dead wrappers, no compatibility shims.

### Data flow

New flow for OpenAI/OpenRouter:
1. User enters API key and optional base URL
2. UI saves plain config payload locally
3. UI creates provider service from that config
4. UI marks provider as ready in session/runtime state
5. Later loads restore the provider directly from stored config

This removes the old split flow of:
setup passkey -> derive key -> unlock session -> decrypt provider config -> restore service

### Error handling

Keep only boundary checks that still matter:
- required API key must be present before save
- malformed stored JSON should surface a load error and not create a broken provider service
- delete/reset should clear the stored provider config and ready state cleanly

Do not keep impossible errors such as “master key not unlocked” once the feature is removed.

### Testing

Minimum verification:
1. Save OpenAI config from empty state and use it immediately
2. Save OpenRouter config from empty state and use it immediately
3. Reload extension/app and verify provider configs restore without any master key prompt
4. Delete provider config and verify state returns to no-config
5. Confirm no visible master key or migration UI remains
6. Confirm related docs mention that provider API keys are plain local storage now

## Risks

The security trade-off is explicit:
- API keys are no longer encrypted at rest
- anyone with access to the local app data can read them

This is accepted by product direction for the current state of the project.

## Acceptance criteria

The work is complete when:
- no provider save/load path depends on master key state
- no master key UI is reachable
- OpenAI and OpenRouter work after save and after restart without passkey input
- old migration/encryption code is removed or fully disconnected
- `CLAUDE.md` is updated to mention the provider storage behavior change

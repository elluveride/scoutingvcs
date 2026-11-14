import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readMetadata = (name: string) => JSON.parse(readFileSync(`public/.well-known/${name}`, 'utf8'));

describe('MCP discovery boundaries', () => {
  it('advertises the canonical remote MCP resource, not the app HTML route', () => {
    const catalog = readMetadata('mcp.json');
    const resource = readMetadata('oauth-protected-resource');
    expect(catalog.url).toBe(resource.resource);
    expect(new URL(resource.resource).pathname).toBe('/functions/v1/mcp');
    expect(catalog.transport).toBe('streamable-http');
  });

  it('requires caller OAuth and accepts bearer tokens only in headers', () => {
    const catalog = readMetadata('mcp.json');
    const resource = readMetadata('oauth-protected-resource');
    expect(catalog.authentication.type).toBe('oauth2');
    expect(resource.bearer_methods_supported).toEqual(['header']);
    expect(resource.authorization_servers).toEqual([new URL('/auth/v1', resource.resource).href]);
  });
});
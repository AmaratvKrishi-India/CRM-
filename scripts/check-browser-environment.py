#!/usr/bin/env python3
"""Fail closed if existing protected manual browser environment cannot be verified."""
import json
import os
from urllib.request import Request, urlopen

assert os.environ.get('GITHUB_REF') == 'refs/heads/main'
assert os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
base = 'https://api.github.com/repos/AmaratvKrishi-India/CRM-/environments/CRM-Production-Browser'
def get(url):
    with urlopen(Request(url, headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json'}), timeout=20) as response:
        return json.load(response)
try:
    env = get(base)
    assert env['name'] == 'CRM-Production-Browser'
    rules = env.get('protection_rules', [])
    assert any(rule.get('type') == 'required_reviewers' and rule.get('prevent_self_review') is True and rule.get('reviewers') for rule in rules)
    assert env.get('deployment_branch_policy', {}).get('custom_branch_policies') is True
    policies = get(base + '/deployment-branch-policies')['branch_policies']
    assert policies and all(policy.get('name') == 'main' and policy.get('type', 'branch') == 'branch' for policy in policies)
except Exception:
    raise SystemExit('BLOCKED: existing main-only environment with required independent reviewers could not be verified. Owner must configure permissions/protection; no bypass secret was consumed.')
print('Protected browser environment verified; owner review remains required.')

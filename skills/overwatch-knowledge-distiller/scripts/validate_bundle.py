#!/usr/bin/env python3
"""Validate structure and provenance references; this does not verify game knowledge."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

try:
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError:
    raise SystemExit('Missing dependency. Run: python -m pip install -r requirements.txt')

ROOT = Path(__file__).resolve().parents[1]
OFFICIAL_HOSTS = {'overwatch.blizzard.com', 'ow.blizzard.cn', 'us.forums.blizzard.com', 'eu.forums.blizzard.com'}
CORE_SLOTS = {'rule', 'conditions', 'actions'}


def validate_bundle(data: Any, schema_path: Path | None = None, *, production: bool = False) -> list[str]:
    """Return all detected issues without writing files or accessing the network."""
    schema = json.loads((schema_path or ROOT / 'assets/bundle.schema.json').read_text(encoding='utf-8'))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = [f"schema:{'/'.join(map(str, e.absolute_path)) or '/'}: {e.message}"
              for e in sorted(validator.iter_errors(data), key=lambda e: str(list(e.absolute_path)))]
    if errors:
        return errors

    def index(items: list[dict[str, Any]], name: str) -> dict[str, dict[str, Any]]:
        result: dict[str, dict[str, Any]] = {}
        for item in items:
            if item['id'] in result:
                errors.append(f'{name}: duplicate id {item["id"]}')
            result[item['id']] = item
        return result

    sources = index(data['sources'], 'sources')
    evidence = index(data['evidence'], 'evidence')
    cards = index(data['cards'], 'cards')
    claims = index([cl for card in cards.values() for cl in card['claims']], 'claims')
    index(data['unresolved_units'], 'unresolved_units')
    known_cards = set(cards) | set(data['external_card_ids'])
    if set(cards) & set(data['external_card_ids']):
        errors.append('external_card_ids: must not duplicate locally included cards')

    def official_source(src: dict[str, Any]) -> bool:
        parsed = urlparse(src['uri'] or '')
        return (src['type'] == 'official_page' and parsed.scheme == 'https'
                and parsed.hostname in OFFICIAL_HOSTS and src['access'] in {'full', 'partial'}
                and 'official_page' in src['modalities'] and src['retrieved_at'] is not None)

    for src in sources.values():
        if production and src['type'] == 'synthetic':
            errors.append(f'{src["id"]}: synthetic source forbidden in production')
        for rng in src['coverage']['ranges']:
            if rng['end_s'] < rng['start_s']:
                errors.append(f'{src["id"]}: reversed coverage interval')
            if src['duration_seconds'] is not None and rng['end_s'] > src['duration_seconds']:
                errors.append(f'{src["id"]}: coverage exceeds source duration')

    for ev in evidence.values():
        src = sources.get(ev['source_id'])
        if src is None:
            errors.append(f'{ev["id"]}: unknown source {ev["source_id"]}')
            continue
        if src['access'] == 'unavailable' or src['modalities'] == ['metadata']:
            errors.append(f'{ev["id"]}: unread content cannot support an evidence record')
        if ev['channel'] not in src['modalities']:
            errors.append(f'{ev["id"]}: channel absent from source modalities')
        loc = ev['locator']
        start, end = loc['start_s'], loc['end_s']
        if (start is None) != (end is None):
            errors.append(f'{ev["id"]}: both time bounds must be present or absent')
        elif start is not None:
            if end < start:
                errors.append(f'{ev["id"]}: reversed evidence interval')
            if src['duration_seconds'] is not None and end > src['duration_seconds']:
                errors.append(f'{ev["id"]}: evidence exceeds source duration')
            # Contiguous inspected intervals may jointly cover an evidence interval.
            cursor = start
            for rng in sorted(src['coverage']['ranges'], key=lambda r: r['start_s']):
                if rng['start_s'] <= cursor <= rng['end_s']:
                    cursor = max(cursor, rng['end_s'])
            if cursor < end or not any(r['start_s'] <= start <= r['end_s'] for r in src['coverage']['ranges']):
                errors.append(f'{ev["id"]}: evidence lies outside inspected ranges')
        elif not loc['text_locator']:
            errors.append(f'{ev["id"]}: requires timestamp or text locator')
        if ev['channel'] == 'official_page' and not official_source(src):
            errors.append(f'{ev["id"]}: official evidence requires an accessed official HTTPS source')

    for card in cards.values():
        cid = card['id']
        category = card['primary_category']
        if category in {'tank', 'damage', 'support'} and card['primary_hero']['role'] != category:
            errors.append(f'{cid}: primary hero role differs from primary category')
        if production and card['status'] == 'demo':
            errors.append(f'{cid}: demo card forbidden in production')
        slots = [cl['slot'] for cl in card['claims']]
        if category != 'version' and slots.count('rule') != 1:
            errors.append(f'{cid}: a teaching card needs exactly one core rule')
        if category == 'version':
            if not any(s in {'fact', 'change'} for s in slots):
                errors.append(f'{cid}: version card needs an official fact or change')
            if any(cl['basis'] != 'official_fact' or cl['slot'] not in {'fact', 'change'} for cl in card['claims']):
                errors.append(f'{cid}: version card may only contain official facts or changes; put tactics in teaching cards')
        has_official = False
        for cl in card['claims']:
            refs = [evidence[eid] for eid in cl['evidence_ids'] if eid in evidence]
            for eid in cl['evidence_ids']:
                if eid not in evidence:
                    errors.append(f'{cl["id"]}: unknown evidence {eid}')
            for parent in cl['derived_from_claim_ids']:
                if parent not in claims or parent == cl['id']:
                    errors.append(f'{cl["id"]}: missing or self-referencing parent claim {parent}')
            if cl['basis'] == 'official_fact':
                has_official = True
                if not refs or any(ev['channel'] != 'official_page' or ev['review_status'] != 'confirmed'
                                   or not official_source(sources.get(ev['source_id'], {
                                       'uri':None, 'type':'synthetic', 'access':'unavailable', 'modalities':[], 'retrieved_at':None}))
                                   for ev in refs):
                    errors.append(f'{cl["id"]}: official_fact requires confirmed official-page evidence')
            if cl['basis'] == 'observed_event' and any(ev['channel'] != 'video' for ev in refs):
                errors.append(f'{cl["id"]}: observed_event requires visual evidence')
            if cl['basis'] == 'source_statement' and any(ev['channel'] not in {'transcript', 'audio', 'text', 'synthetic'} for ev in refs):
                errors.append(f'{cl["id"]}: source_statement needs actual speech or authored text')
            if card['status'] == 'ready':
                if any(ev['review_status'] != 'confirmed' for ev in refs):
                    errors.append(f'{cid}: ready card contains uncertain evidence')
                if cl['basis'] == 'model_inference' and cl['slot'] in CORE_SLOTS:
                    errors.append(f'{cid}: inferred core teaching must remain needs_review')
            if card['status'] != 'demo' and any(sources.get(ev['source_id'], {}).get('type') == 'synthetic' for ev in refs):
                errors.append(f'{cid}: synthetic evidence may support only demo cards')

        ver = card['version']
        for dep in ver['depends_on_cards']:
            target = cards.get(dep)
            if target is None or target['primary_category'] != 'version' or dep == cid:
                errors.append(f'{cid}: include the referenced version-card snapshot for {dep}')
            elif ver['status'] == 'verified_for_scope':
                if target['version']['status'] != 'verified_for_scope' or target['status'] != 'ready':
                    errors.append(f'{cid}: verified teaching depends on an unverified/unready version card')
                if target['version']['target_scope'] != ver['target_scope']:
                    errors.append(f'{cid}: dependency target_scope differs; review before claiming verification')
        if ver['status'] == 'verified_for_scope':
            if ver['checked_at'] is None:
                errors.append(f'{cid}: verified_for_scope requires checked_at')
            if any(ver['target_scope'][k] is None for k in ('region', 'environment', 'mode', 'platform', 'patch_id')):
                errors.append(f'{cid}: verified_for_scope requires an explicit target_scope; use all_platforms only with evidence')
            if not has_official and not ver['depends_on_cards']:
                errors.append(f'{cid}: verified_for_scope lacks official evidence or version dependencies')
        if ver['status'] == 'conflict' and card['status'] == 'ready':
            errors.append(f'{cid}: unresolved version conflict cannot be ready')
        for kind, related in card['relations'].items():
            for target in related:
                if target not in known_cards or target == cid:
                    errors.append(f'{cid}: invalid {kind} reference {target}')

    for unit in data['unresolved_units']:
        if unit['source_id'] is not None and unit['source_id'] not in sources:
            errors.append(f'{unit["id"]}: unknown source')

    # A cyclic derivation cannot establish an independent basis for a claim.
    visiting: set[str] = set()
    visited: set[str] = set()
    def visit(key: str) -> None:
        if key in visiting:
            errors.append(f'{key}: cyclic claim derivation')
            return
        if key in visited or key not in claims:
            return
        visiting.add(key)
        for parent in claims[key]['derived_from_claim_ids']:
            visit(parent)
        visiting.remove(key)
        visited.add(key)
    for key in claims:
        visit(key)
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle', type=Path)
    parser.add_argument('--production', action='store_true', help='Also reject synthetic sources and demonstration cards.')
    args = parser.parse_args()
    try:
        data = json.loads(args.bundle.read_text(encoding='utf-8'))
        errors = validate_bundle(data, production=args.production)
    except (OSError, ValueError, RecursionError) as exc:
        print(f'ERROR: {exc}', file=sys.stderr)
        return 2
    if errors:
        for error in errors:
            print(f'ERROR: {error}', file=sys.stderr)
        return 1
    print(f'PASS: {len(data["sources"])} sources, {len(data["evidence"])} evidence records, '
          f'{len(data["cards"])} cards. Semantic/video verification is not performed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

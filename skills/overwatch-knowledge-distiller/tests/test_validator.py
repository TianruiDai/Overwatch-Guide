"""Run from the skill root: python -m unittest discover -s tests -v"""
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('ow_validator', ROOT / 'scripts/validate_bundle.py')
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
validate_bundle = module.validate_bundle


class ValidatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.data = json.loads((ROOT / 'examples/demo.bundle.json').read_text(encoding='utf-8'))

    def assertIssue(self, fragment: str) -> None:
        result = validate_bundle(self.data)
        self.assertTrue(any(fragment in item for item in result), result)

    def test_valid_demo(self) -> None:
        self.assertEqual(validate_bundle(self.data), [])

    def test_production_excludes_demo(self) -> None:
        result = validate_bundle(self.data, production=True)
        self.assertTrue(any('forbidden in production' in item for item in result))

    def test_missing_evidence(self) -> None:
        self.data['cards'][0]['claims'][0]['evidence_ids'] = ['MISSING']
        self.assertIssue('unknown evidence')

    def test_wrong_role(self) -> None:
        self.data['cards'][0]['primary_hero']['role'] = 'support'
        self.assertIssue('differs from primary category')

    def test_no_unsupported_official_fact(self) -> None:
        self.data['cards'][0]['claims'][0]['basis'] = 'official_fact'
        self.assertIssue('official_fact requires')

    def test_no_invented_visual_evidence(self) -> None:
        self.data['cards'][0]['claims'][0]['basis'] = 'observed_event'
        self.assertIssue('requires visual evidence')

    def test_verified_requires_scope(self) -> None:
        self.data['cards'][0]['version']['status'] = 'verified_for_scope'
        self.assertIssue('requires an explicit target_scope')

    def test_duplicate_ids(self) -> None:
        self.data['cards'].append(copy.deepcopy(self.data['cards'][0]))
        self.assertIssue('duplicate id')

    def test_timestamp_outside_coverage(self) -> None:
        self.data['evidence'][0]['locator'].update(start_s=2.0, end_s=5.0)
        self.assertIssue('outside inspected ranges')

    def test_reversed_timestamp(self) -> None:
        self.data['evidence'][0]['locator'].update(start_s=5.0, end_s=2.0)
        self.assertIssue('reversed evidence interval')

    def test_unread_source(self) -> None:
        self.data['sources'][0]['access'] = 'unavailable'
        self.assertIssue('unread content')

    def test_cycle(self) -> None:
        a, b = self.data['cards'][0]['claims'][:2]
        a['derived_from_claim_ids'] = [b['id']]
        b['derived_from_claim_ids'] = [a['id']]
        self.assertIssue('cyclic claim derivation')

    def test_unclassified_version_rumor_cannot_be_fact(self) -> None:
        card = self.data['cards'][0]
        card['primary_category'] = 'version'
        self.assertIssue('only contain official facts')

    def test_missing_primary_hero(self) -> None:
        self.data['cards'][0]['primary_hero'] = None
        self.assertIssue('schema:')

    def test_metadata_only_cannot_be_evidence(self) -> None:
        self.data['sources'][0]['modalities'] = ['metadata']
        self.assertIssue('unread content')

    def test_schema_missing_field(self) -> None:
        del self.data['cards'][0]['version']
        self.assertIssue('schema:')

    def test_source_author_not_required_for_unavailable_content(self) -> None:
        self.data['sources'][0].update(type='video_url', access='unavailable', modalities=['metadata'])
        self.data.update(evidence=[], cards=[])
        self.assertEqual(validate_bundle(self.data), [])

    def test_contiguous_coverage(self) -> None:
        self.data['sources'][0]['coverage']['ranges'] = [
            {'start_s':0, 'end_s':3}, {'start_s':3, 'end_s':6}]
        self.data['evidence'][0]['locator'].update(start_s=2, end_s=5)
        self.assertEqual(validate_bundle(self.data), [])


if __name__ == '__main__':
    unittest.main()

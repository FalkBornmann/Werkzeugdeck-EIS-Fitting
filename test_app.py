import io
import json
import struct
import unittest

import numpy as np

from app import Handler, fit, load_spectrum, select_models, spectrum
from circuits import ELEMENTS, element_impedance, fit_custom, join, search, validate_custom


def csv_spectrum(frequencies, real=1, imag=-2):
    rows = ["frequency_Hz,Zreal_ohm,Zimag_ohm"]
    rows.extend(f"{f},{real},{imag}" for f in frequencies)
    return "\n".join(rows).encode()


class ImportTests(unittest.TestCase):
    def test_descending_csv_is_sorted_without_changing_sign(self):
        f, z = load_spectrum(csv_spectrum(range(8, 0, -1)), ".csv")
        np.testing.assert_array_equal(f, np.arange(1, 9))
        np.testing.assert_array_equal(z, np.full(8, 1 - 2j))

    def test_ism_phase_in_radians_and_truncated_file(self):
        count = 8
        values = [*range(8, 0, -1), *([10] * count), *([-np.pi / 2] * count)]
        raw = (bytes.fromhex("0000fffffffe") + (count - 1).to_bytes(6, "big")
               + struct.pack(">24d", *values) + bytes(10 * count))
        f, z = load_spectrum(raw, ".ism")
        np.testing.assert_array_equal(f, np.arange(1, 9))
        np.testing.assert_allclose(z, -10j, atol=1e-12)
        with self.assertRaisesRegex(ValueError, "ISM"):
            load_spectrum(raw[:-1], ".ism")

    def test_rejects_invalid_spectra(self):
        for data in (
            csv_spectrum(range(1, 8)), csv_spectrum([1] * 8),
            csv_spectrum(range(8)), csv_spectrum(range(1, 9), "nan"),
            csv_spectrum(range(1, 9), 0, 0), csv_spectrum(range(1, 9), 1e308),
            csv_spectrum([1, 2, 3, 4, 5, 6, 7, 1e308]), b"f,re,im\n1,2,3",
        ):
            with self.subTest(data=data), self.assertRaises(ValueError):
                load_spectrum(data, ".csv")


class FitTests(unittest.TestCase):
    def test_fixed_fit_preserves_order_and_recovers_known_values(self):
        f = np.geomspace(.1, 1e5, 40)
        z = spectrum("RC", np.log10([15, 1400, 1e-5]), f)
        tree = ["s", "R", ["p", "R", "C"]]
        result = fit_custom(tree, f, z)
        self.assertEqual(json.loads(json.dumps(result["topology"])), tree)
        np.testing.assert_allclose(list(result["parameters"].values()), [15, 1400, 1e-5], rtol=1e-5)

    def test_fixed_fit_keeps_indistinguishable_resistors_and_flags_them(self):
        f = np.geomspace(1, 100, 12)
        result = fit_custom(["s", "R", "R"], f, np.full(len(f), 150+0j))
        self.assertEqual(result["topology"], ("s", "R", "R"))
        self.assertTrue(result["limited"])
        self.assertAlmostEqual(sum(result["parameters"].values()), 150, places=4)

    def test_custom_topology_rejects_invalid_or_underdetermined_input(self):
        for tree in ([], ["p","R"], ["x","R","C"], ["s","R","X"], ["s", *["R"]*13]):
            with self.subTest(tree=tree), self.assertRaises(ValueError):
                validate_custom(tree, 20)
        with self.assertRaisesRegex(ValueError, "Zu wenige"):
            validate_custom(["p", *["Q"]*8], 8)

    def test_limits_and_components(self):
        self.assertEqual(select_models("R,C,Q", 3), ["RC"])
        self.assertEqual(select_models("R,C,Q", 4), ["RC", "RQ"])
        self.assertEqual(select_models("R,Q", 6), ["RQ"])
        self.assertEqual(select_models("R,Q", 7), ["RQ", "2RQ", "nested"])
        for components, limit in [("", 4), ("R", 7), ("C,Q", 7), ("R,Q", 3), ("R,L", 7), ("R,C", 8)]:
            with self.subTest(components=components, limit=limit), self.assertRaises(ValueError):
                select_models(components, limit)

    def test_recovers_known_rc_with_minimum_points(self):
        f = np.geomspace(.1, 1e5, 8)
        z = spectrum("RC", np.log10([15, 1400, 1e-5]), f)
        result = fit("RC", f, z)
        np.testing.assert_allclose(list(result["parameters"].values()), [15, 1400, 1e-5], rtol=1e-5)
        self.assertLess(result["rms"], 1e-4)

    def test_api_enforces_selection(self):
        handler = object.__new__(Handler)
        handler.path = "/demo"
        handler.headers = {"X-Components": "R,C", "X-Parameter-Limit": "3"}
        handler.rfile = io.BytesIO()
        result = []
        handler.send = lambda body, content_type, status=200: result.append((status, json.loads(body)))
        handler.do_POST()
        status, body = result.pop()
        self.assertEqual(status, 200)
        self.assertEqual([item["model"] for item in body["fits"]], ["RC"])
        handler.headers["X-Parameter-Limit"] = "bad"
        handler.do_POST()
        self.assertEqual(result.pop()[0], 400)

    def test_generated_fit_respects_types_and_recovers_repeated_resistor(self):
        f = np.geomspace(.1, 1e5, 40)
        z = spectrum("RC", np.log10([15, 1400, 1e-5]), f)
        results = search("R,C", 3, f, z)
        self.assertTrue(all(item["elements"] <= 3 for item in results))
        self.assertEqual(results[0]["model"], "((C ∥ R) + R)")
        self.assertLess(results[0]["rms"], 1e-4)
        self.assertEqual(join("s", "R", "R"), None)

    def test_cpe_counts_as_one_element(self):
        f = np.geomspace(1, 1e4, 8)
        z = element_impedance("Q", 2j * np.pi * f, 1e-5, .8)
        result = search("Q", 1, f, z)[0]
        self.assertEqual(result["elements"], 1)
        self.assertEqual(len(result["parameters"]), 2)
        self.assertLess(result["rms"], 1e-4)

    def test_catalog_is_finite_over_supported_frequency_range(self):
        w = 2j * np.pi * np.geomspace(1e-12, 1e12, 50)
        for kind, parameters in ELEMENTS.items():
            with self.subTest(kind=kind):
                b = .8 if len(parameters) == 2 and parameters[1] == "n" else .01
                self.assertTrue(np.isfinite(element_impedance(kind, w, 1., b)).all())


if __name__ == "__main__":
    unittest.main()

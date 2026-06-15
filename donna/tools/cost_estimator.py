"""Legal fee estimator — rule-based + LLM enrichment for PI cases."""

from __future__ import annotations

import os

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "estimate_case_value",
            "description": (
                "Estimate the probable case value and contingency fee range for a personal injury matter. "
                "Call after intake is complete and injuries/treatment are known."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "incident_type": {
                        "type": "string",
                        "enum": ["auto_accident", "slip_and_fall", "dog_bite", "product_liability", "wrongful_death", "other"],
                    },
                    "injury_severity": {
                        "type": "string",
                        "enum": ["minor", "moderate", "serious", "catastrophic"],
                        "description": "minor=soft tissue only; moderate=fractures/surgery; serious=disability/long-term; catastrophic=TBI/paralysis/death",
                    },
                    "medical_bills_usd": {
                        "type": "number",
                        "description": "Known or estimated medical bills to date in USD",
                    },
                    "lost_wages_usd": {
                        "type": "number",
                        "description": "Lost wages to date in USD (0 if unknown)",
                    },
                    "liability_clear": {
                        "type": "boolean",
                        "description": "Whether fault is clearly established",
                    },
                    "insurance_available": {
                        "type": "boolean",
                        "description": "Whether defendant has insurance coverage",
                    },
                },
                "required": ["incident_type", "injury_severity", "medical_bills_usd"],
            },
        },
    }
]

# Multipliers: (low, high) applied to specials for pain & suffering estimate
_SEVERITY_MULTIPLIER = {
    "minor": (1.0, 2.5),
    "moderate": (2.5, 5.0),
    "serious": (5.0, 10.0),
    "catastrophic": (10.0, 20.0),
}

_CONTINGENCY_FEE = 0.33  # 33% standard PI contingency


def estimate_case_value(
    *,
    incident_type: str,
    injury_severity: str,
    medical_bills_usd: float,
    lost_wages_usd: float = 0.0,
    liability_clear: bool = True,
    insurance_available: bool = True,
) -> dict:
    """Rule-based PI case value estimate."""
    specials = medical_bills_usd + lost_wages_usd
    low_mult, high_mult = _SEVERITY_MULTIPLIER.get(injury_severity, (1.0, 3.0))

    pain_suffering_low = specials * low_mult
    pain_suffering_high = specials * high_mult

    gross_low = specials + pain_suffering_low
    gross_high = specials + pain_suffering_high

    # Liability discount — unclear fault reduces by ~40%
    if not liability_clear:
        gross_low *= 0.60
        gross_high *= 0.75

    # No insurance caps recoverable amount significantly
    if not insurance_available:
        gross_high = min(gross_high, 50_000)
        gross_low = min(gross_low, gross_high * 0.5)

    fee_low = gross_low * _CONTINGENCY_FEE
    fee_high = gross_high * _CONTINGENCY_FEE

    note = ""
    if injury_severity == "catastrophic":
        note = "Catastrophic injury — consider specialist referral and structured settlement."
    elif not liability_clear:
        note = "Liability unclear — further investigation required before demand."
    elif not insurance_available:
        note = "Limited insurance — collectability concern; asset investigation recommended."

    return {
        "ok": True,
        "incident_type": incident_type,
        "injury_severity": injury_severity,
        "special_damages_usd": round(specials, 2),
        "estimated_case_value_low_usd": round(gross_low, 2),
        "estimated_case_value_high_usd": round(gross_high, 2),
        "contingency_fee_low_usd": round(fee_low, 2),
        "contingency_fee_high_usd": round(fee_high, 2),
        "contingency_rate": f"{int(_CONTINGENCY_FEE * 100)}%",
        "note": note,
    }

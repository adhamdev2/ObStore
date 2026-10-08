using System;
using CitizenFX.Core;

namespace FivemModes;

public sealed class RemoteStub : BaseScript
{
    public RemoteStub()
    {
        EventHandlers["fivemModes:login"] += new Action<string, string>(RequestAuthentication);
        EventHandlers["fivemModes:action"] += new Action<string, string>(RequestAction);
        EventHandlers["ob1:remote:auth"] += new Action<bool>(OnAuthenticationResult);
        EventHandlers["ob1:remote:action"] += new Action<bool, string>(OnActionResult);
    }

    private void RequestAuthentication(string licenseKey, string hwid)
    {
        if (string.IsNullOrWhiteSpace(licenseKey) || string.IsNullOrWhiteSpace(hwid))
        {
            TriggerEvent("fivemModes:authFailed");
            return;
        }

        TriggerServerEvent("ob1:remote:login", licenseKey, hwid);
    }

    private void RequestAction(string action, string inputJson)
    {
        if (string.IsNullOrWhiteSpace(action) || string.IsNullOrWhiteSpace(inputJson))
        {
            TriggerEvent("fivemModes:actionRejected");
            return;
        }

        if (!LooksLikeJson(inputJson))
        {
            TriggerEvent("fivemModes:actionRejected");
                return;
        }

        TriggerServerEvent("ob1:remote:action", action, inputJson);
    }

    private void OnAuthenticationResult(bool accepted)
    {
        TriggerEvent(accepted ? "fivemModes:authReady" : "fivemModes:authFailed");
    }

    private void OnActionResult(bool accepted, string payloadJson)
    {
        if (!accepted)
        {
            TriggerEvent("fivemModes:actionRejected");
            return;
        }

        if (!LooksLikeJsonObject(payloadJson))
        {
            TriggerEvent("fivemModes:actionRejected");
                return;
        }

        TriggerEvent("fivemModes:renderResult", payloadJson);
    }

    private static bool LooksLikeJson(string value)
    {
        var trimmed = value.Trim();
        return trimmed.Length >= 2 && ((trimmed[0] == '{' && trimmed[trimmed.Length - 1] == '}') || (trimmed[0] == '[' && trimmed[trimmed.Length - 1] == ']'));
    }

    private static bool LooksLikeJsonObject(string value)
    {
        var trimmed = value.Trim();
        return trimmed.Length >= 2 && trimmed[0] == '{' && trimmed[trimmed.Length - 1] == '}';
    }
}

local running = false
local resourceName = GetCurrentResourceName()

local function stopLoader(reason)
    running = false
    TriggerEvent('ob1:loader:stopped', reason or 'authorization_failed')
end

local function executePayload(sourceCode)
    if type(sourceCode) ~= 'string' or #sourceCode == 0 or #sourceCode > 1024 * 1024 then
        return stopLoader('invalid_payload')
    end

    local environment = {
        AddEventHandler = AddEventHandler,
        RegisterNetEvent = RegisterNetEvent,
        TriggerEvent = TriggerEvent,
        TriggerServerEvent = TriggerServerEvent,
        GetGameTimer = GetGameTimer,
        Citizen = Citizen,
        Wait = Wait,
        resourceName = resourceName
    }
    local chunk, compileError = load(sourceCode, '@' .. resourceName .. '/memory', 't', environment)
    if not chunk then return stopLoader('payload_compile_failed:' .. tostring(compileError)) end
    local ok, runtimeError = pcall(chunk)
    if not ok then return stopLoader('payload_runtime_failed:' .. tostring(runtimeError)) end
    running = true
end

RegisterNetEvent('ob1:loader:payload')
AddEventHandler('ob1:loader:payload', function(sourceCode)
    executePayload(sourceCode)
end)

RegisterNetEvent('ob1:loader:stop')
AddEventHandler('ob1:loader:stop', function(reason)
    stopLoader(reason)
end)

CreateThread(function()
    while true do
        Wait(60000)
        if running then
            TriggerServerEvent('ob1:loader:request')
        end
    end
end)

AddEventHandler('onClientResourceStart', function(startedResource)
    if startedResource ~= resourceName then return end
    TriggerServerEvent('ob1:loader:request')
end)
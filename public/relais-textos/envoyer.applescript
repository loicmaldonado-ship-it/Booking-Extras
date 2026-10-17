-- Booking Extras — envoi d'un texto par l'app Messages du Mac.
-- Arguments : numéro (+33…), texte, mode (« sms » ou « imessage »).
-- Mode « sms » : passe par l'iPhone (Transfert de SMS) si disponible, sinon
-- iMessage. Mode « verifier » : ne fait que lister les comptes (sert à
-- déclencher l'autorisation macOS à l'installation).
on run argv
	set numero to item 1 of argv
	set texte to item 2 of argv
	set modeEnvoi to item 3 of argv
	tell application "Messages"
		if modeEnvoi is "verifier" then
			return (service type of every account) as text
		end if
		set leService to missing value
		if modeEnvoi is "sms" then
			try
				set leService to 1st account whose service type = SMS
			end try
		end if
		if leService is missing value then
			set leService to 1st account whose service type = iMessage
		end if
		set leContact to participant numero of leService
		send texte to leContact
	end tell
	return "ok"
end run

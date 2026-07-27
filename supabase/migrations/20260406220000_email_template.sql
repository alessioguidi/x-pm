ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS booking_email_template TEXT DEFAULT '<h1>Prenotazione Confermata!</h1>
<p>Ciao {{guest_name}},</p>
<p>La tua richiesta per la struttura dal <b>{{check_in_date}}</b> al <b>{{check_out_date}}</b> è stata inoltrata con successo!</p>
<p>Prezzo Da Pagare in Struttura: <b>€{{total_price}}</b></p>
<br/>
<p>Saluti,<br/>Lo staff di {{org_name}}</p>';

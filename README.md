# StepUp Durham

This is a repository for scripts used to aid [StepUp Durham](https://www.stepupdurham.org/) to migrate their contact notes and attachments from their old Salesforce org to the new Salesforce org.

# Configuration & Use
Before use, the `config.example.json` file needs to be copied to `config.json` and populated.  Initially you'll just need to fill out the `sourceOrg` and `targetOrg` with the Salesforce credentials.  Also fill out the `log_dir` and `data.dir`.  Then the dump scripts can be ran.  Before running the match and upload scripts you'll want to specify which contact / attachment metadata file to use by setting `data.contacts.src` and `data.attachments.src` respectively.

# Scripts
## dump_source_contacts.js
This dumps all the contacts that match the query under the source Salesforce org.

## dump_target_contacts.js
This dumps all the contacts from the target Salesforce org.

## dump_attachments.js
This dumps all the attachments associated with the dumped contacts and then saves the contents and it's metadata to disk.

## match_contacts.js
This unfies all the contacts from the source and matches them as best as possible with the contacts in the target org.  This first starts by trying to match by email.  If an exact match is found then it is recorded.  Then it looks for contacts with the same first and last name as the desired contact.

Once this is run then it will generate three files.  A json file containing all the exact matches (exactly one match based on email or name).  A json file containing unclear matches of contacts that have more than one possible match.  A json file containing unmatched contacts that cannot find anything that looks like it could be the contact.

## upload_notes.js
This uploads all the notes for the matched contacts to the target Salesforce org

## upload_attachments.js
This uploads all the attachments for the matched contacts to the target Salesforce org

## target_userid.js
This outputs the user id of the running user in the target org
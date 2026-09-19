-- Keep database effect references identical to the case-sensitive folder names
-- deployed under app/Attack Effect/.

update skill_catalog
set attack_effect = '66_Strike_blue'
where attack_effect = '66_Strike';

update skill_catalog
set attack_effect = '68_SlashEffect_blue'
where attack_effect = '68_SlashEffect_Blue';

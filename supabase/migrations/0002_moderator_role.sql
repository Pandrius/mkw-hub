-- Nuevo rol entre editor y admin. Va en su propia migración porque un valor
-- nuevo de un enum no se puede usar en la misma transacción que lo crea.
alter type public.user_role add value 'moderator' before 'admin';

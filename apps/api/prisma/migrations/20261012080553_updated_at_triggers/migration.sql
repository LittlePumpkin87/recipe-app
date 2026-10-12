-- Update Trigger Function for recipe updates.

CREATE OR REPLACE FUNCTION set_recipe_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_recipe_updated_at
    BEFORE UPDATE ON recipe
    FOR EACH ROW
    EXECUTE FUNCTION set_recipe_updated_at();

CREATE OR REPLACE FUNCTION touch_recipe_from_ingredient()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    affected_recipe_id uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        affected_recipe_id := OLD.recipe_id;
    ELSE
        affected_recipe_id := NEW.recipe_id;
    END IF;

    UPDATE recipe
        SET updated_at = now()
    WHERE id = affected_recipe_id;

    RETURN NULL;
END;
$$;

CREATE TRIGGER recipe_ingredient_touches_recipe
    AFTER INSERT OR UPDATE OR DELETE ON recipe_ingredient
    FOR EACH ROW
    EXECUTE FUNCTION touch_recipe_from_ingredient();
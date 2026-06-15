package com.storeflow.common.exception;

public class DuplicateResourceException extends BusinessException {
    public DuplicateResourceException(String entity, String field, Object value) {
        super("DUPLICATE_" + entity.toUpperCase(),
              entity + " with " + field + " '" + value + "' already exists");
    }
}

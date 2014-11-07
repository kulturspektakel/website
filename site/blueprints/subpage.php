<?php if(!defined('KIRBY')) exit ?>

title: Unterseite
pages: false
files: true
preview: parent
fields:
  title:
    label: Title
    type:  text
  top:
    label: Text (oben)
    type:  textarea
  columns:
    label: Spalten
    type: structure
    entry: >
      {{columntext}}
    fields:
      columntext:
        label: Spalte
        type: textarea
  bottom:
    label: Text (uten)
    type:  textarea
  

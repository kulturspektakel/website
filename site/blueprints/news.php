<?php if(!defined('KIRBY')) exit ?>

title: News
pages: true
files: true
fields:
  title:
    label: Title
    type:  text
  datum:
    label: Datum
    type: date
  text:
    label: Text
    type: textarea
    size: large